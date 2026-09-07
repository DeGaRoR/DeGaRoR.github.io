// CAGE UI — the shared demonstrator runtime for _cage2/_cage3 (and later
// pages). Throwaway, gitignored with the _cage* family, never in MANIFEST.
//
// Rendering is THREE.JS (the project's pinned vendor/three.min.js, r128)
// with a real z-buffer — the earlier hand-rolled canvas painter caused a
// stream of sort/culling artefacts that were pure renderer, not geometry
// (user verdict: "I'm fed up diagnosing renderer issues"). Pages must load
// ../vendor/three.min.js before this file.
//
// A page defines window.CAGE_PAGE = {
//   defaults:   param overrides applied on top of CAGE_PARAMS,
//   groups:     extra advanced slider groups (appended to the base set),
//   defaultStep:'crease' | '2' | ...,
//   presets:    { name: {param overrides} } shown in a preset menu,
// } then loads _cage_gen.js and this file. The page's HTML skeleton must
// carry the header controls and the #view/#ui layout (see _cage8.html, the
// one standalone bench left since 2026-09-05).
'use strict';
// THE BOOT IS A NAMED FUNCTION (G35): standalone bench pages boot at load
// exactly as before; the GAME bundle sets window.CAGE_UI_LAZY before this
// script and calls CAGE_UI_BOOT() on first garage entry instead — the
// editor pays its build cost when opened, not at game boot. Re-entry is
// a no-op (CAGE_UI already set).
function CAGE_UI_BOOT() {
if (window.CAGE_UI) return;
const G = window.CAGE2;
const PAGE = window.CAGE_PAGE || {};
const $ = id => document.getElementById(id);

const SEC = {
  body:            '#8b95a2',
  windshield:      '#cc2f47',
  pillarWindow:    '#cc8314',
  pilotWindow:     '#1b67cc',
  pillarCabin:     '#12cc10',
  pasengerWindow:  '#5ecc12',
  pillarPassenger: '#2b28cc',
  pillarTail:      '#cc2b80',
  pillarFront:     '#8a5ecc',
  taper:           '#2fa89c',
  pillarTaper:     '#12ccb9',
  taperPanel:      '#aab6c2',
  skyWindows:      '#cc5a12',
  ceilingLoop:     '#3a3a3a',
  floorLoop:       '#1c1c1c',
  waistband:       '#cc12a8',
  joint:           '#d8dde4',
  boomTube:        '#8fa3b8',
  bulkhead:        '#8a7a5f',
  firewall:        '#8a4a2f',
  fireProof:       '#d9dee3',
  fireSeal:        '#4a4f55',
  dash:            '#333a45',
  dashFace:        '#7d8896',
  tube:            '#93a0ad',
  plywood:         '#b5854e',
  woodFrame:       '#8a6134',
  cloth:           '#cfc6b2',
  composite:       '#3a3f46',
  aluminium:       '#c3c9d0',
  toele:           '#aab3bd',
};

// ---- parameters -----------------------------------------------------------
const DEFAULTS = Object.assign(
  JSON.parse(JSON.stringify(G.CAGE_PARAMS)), PAGE.defaults || {});
const P = JSON.parse(JSON.stringify(DEFAULTS));

// MACROS RETIRED (user ruling 2026-08-17): multipliers over base params
// were two ways to state one fact — save-format ambiguity. Everything
// goes through sections now.

const BASE_GROUPS = [
  ['layout', [
    ['paxCount',  'pax bays',      0, 4, 1],
    ['paxLen',    'pax len',       0.4, 3.0, 0.01],
    ['pilotLen',  'pilot len',     0.3, 2.0, 0.01],
    ['boomLen',   'boom len',      1.0, 6.0, 0.01],
    ['tailLen',   'tail len',      0.05, 0.6, 0.005],
    ['pillarW',   'pillar width',  0.00, 0.30, 0.005],
    ['cabPillarW','cabin pillar',  0.02, 0.30, 0.005],
    ['paxPillarW','pax pillar',    0.02, 0.30, 0.005],
  ]],
  ['section', [
    ['halfW',     'half width',    0.20, 1.00, 0.005],
    ['roofHalfW', 'roof half-W',   0.15, 0.90, 0.005],
    ['roofY',     'roof y',        0.40, 1.60, 0.005],
    ['keelY',     'keel y',       -1.60, -0.30, 0.005],
    ['floorY',    'floor y',      -1.20, 0.00, 0.005],
    ['ceilInset', 'ceil inset x',  0.20, 3.00, 0.01],
    ['waistY',    'waist y',      -0.40, 0.50, 0.005],
    ['bandH',     'band height',   0.01, 0.30, 0.002],
    ['ringPullIn','sill pull-in',  0.00, 0.15, 0.002],
  ]],
  ['aft + tail', [
    ['aftRoofY',  'aft roof y',    0.20, 1.20, 0.005],
    ['aftKeelY',  'aft keel y',   -1.20, -0.10, 0.005],
    ['tailHalfW', 'tail half-W',   0.02, 0.40, 0.002],
    ['tailRoofY', 'tail roof y',   0.10, 1.00, 0.005],
    ['tailKeelY', 'tail keel y',  -0.50, 0.30, 0.005],
  ]],
  ['windscreen', [
    ['wsRun',     'windscreen run', 0.20, 2.00, 0.01],
    ['wsTopOff',  'windscreen top off', 0.00, 0.50, 0.005],
    ['wsBaseBow', 'base bow',      0.00, 1.20, 0.01],
    ['wsCeilBow', 'ceil bow',      0.00, 0.60, 0.005],
    ['apilW',     'A-pillar w ×',  0.20, 3.00, 0.01],
    ['apilPerp',  'A-pillar perp', 0, 1, 0.05],
  ]],
  ['nose', [
    ['noseLen',   'nose len',      0.20, 2.50, 0.01],
    ['noseW',     'nose w ×',      0.50, 1.50, 0.01],
    ['pfW',       'front pillar ×',0.30, 3.00, 0.01],
  ]],
  ['creases', [
    ['crPillar',  'pillars',       0, 3, 0.05],
    ['crSill',    'sill',          0, 3, 0.05],
    ['crBand',    'waistband',     0, 3, 0.05],
    ['crCeil',    'ceil rail',     0, 3, 0.05],
    ['crFrame',   'windscreen frame', 0, 3, 0.05],
    ['crCap',     'caps',          0, 3, 0.05],
  ]],
  ['glazing', [
    ['skylight',  'skylight',      0, 1, 1],
    ['skyExt',    'sky extent',    0, 5, 1, { when: P => +P.skylight }],
    ['winSillPilot', 'pilot win sill', 0, 0.9, 0.01],
    ['winSillPax',   'pax win sill',   0, 0.9, 0.01],
  ]],
  ['cutting', [
    ['cutParts',  'cut parts',     0, 1, 1],
  ]],
  ['interior', [
    ['intOn',     'interior on',   0, 1, 1],
    ['intCons',   'construction',  0, 3, 1, ['composite', 'steel tube',
                                             'plywood', 'aluminium']],
    ['intBulk',   'aft bulkhead',  0, 1, 1],
    ['intFire',   'firewall',      0, 1, 1],
    ['intPillars','pillar bodies', 0, 1, 1],
    ['shellT',    'shell thickness', 0.01, 0.10, 0.002],
    ['intDash',   'dashboard',     0, 1, 1],
    ['dashBack',  'dash setback',  0.01, 0.30, 0.005,
     { when: P => +P.intOn && +P.intDash }],
    ['dashLip',   'dash lip height', 0.01, 0.10, 0.002,
     { when: P => +P.intOn && +P.intDash }],
    ['dashDepth', 'dash depth',    0.05, 0.80, 0.01,
     { when: P => +P.intOn && +P.intDash }],
    ['dashCrease','dash crease',   0, 3, 0.05,
     { when: P => +P.intOn && +P.intDash }],
  ]],
  ['window joints', [
    ['rimW',      'rim size',     0.00, 0.04, 0.001],
    // G206: the strip's rise (a fraction of rimW) and the pane's step down
    ['rimRise',   'rim rise',     0.05, 1, 0.01],
    ['paneInset', 'pane inset',   -0.01, 0.01, 0.0005],
    ['paneThick', 'pane edge',    0, 0.01, 0.0005],
    ['rimRivet',  'frame rivets', 0, 0.10, 0.005],
    ['rimSides',  'rim sides',    4, 10, 1],
    ['rimArc',    'corner sections', 1, 6, 1],
    ['rimWin',    'window rims',  0, 1, 1],
    ['rimWs',     'windscreen rim', 0, 1, 1],
    ['rimDoor',   'door rim',     0, 1, 1],
    ['doorOn',    'pilot door',   0, 1, 1],
    ['doorPax',   'pax doors',    0, 1, 1],
    ['doorDeep',  'door to belly',0, 1, 1],
    ['doorSill',  'door sill',    0, 0.25, 0.002,
     { when: P => +P.doorOn }],
    ['doorSillPax','pax door sill',0, 0.25, 0.002,
     { when: P => +P.doorPax }],
  ]],
];
// a page may REPLACE the whole panel (the curated tree preview) or just
// append extra groups to the base set
const GROUPS = PAGE.groupsOverride
  ? PAGE.groupsOverride
  : BASE_GROUPS.concat(PAGE.groups || []);
// items may nest one level: ['sub name', [items...], 'open'?, {when}?]

// ---- three.js scene -------------------------------------------------------
// EXTERNAL SCENE (G36): when the GAME mounts the editor it hands a Group
// via window.CAGE_UI_SCENE before boot. The cage build then lives inside
// the game's own garage scene and is rendered by the game's own renderer
// — its hangar, its moods, its sRGB/ACES/shadow pipeline — and this file
// creates NO renderer, camera rig, canvas wiring or lights of its own.
// One renderer, one look: the cure for the G35.2-4 pipeline chase (user:
// "why wouldn't you just use the previous environment as it is and put
// the mesh in it?"). Standalone bench pages keep the whole local rig.
let yaw = -0.85, pitch = 0.30, drag = null, ZOOM = 1;
let M0 = null, MS = null;
const EXT = window.CAGE_UI_SCENE || null;
// namespaced ids first (the GAME's editor mount — its shell already owns
// #c and #ui), the bench pages' own ids as the fallback
const cv = EXT ? null : ($('cgC') || $('c'));
const renderer = EXT ? null : new THREE.WebGLRenderer({
  canvas: cv, antialias: true, preserveDrawingBuffer: true });
const scene = EXT || new THREE.Scene();
// a handle for measuring the bench from the console — every placement bug in
// the light arc was found by reading boxes, not by squinting at a screenshot
window.CAGE_SCENE = scene;
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x33383f, 0.95);
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(-3, 4, -5);
const sun2 = new THREE.DirectionalLight(0xcfd8ff, 0.25);
sun2.position.set(4, -1, 3);
if (!EXT) {
  scene.background = new THREE.Color(0x12151a);
  scene.add(hemi); scene.add(sun); scene.add(sun2);
  // THE STANDALONE BENCH NEEDS AN ENVIRONMENT FOR AEROSKIN, and G35.3 is why:
  // Lambert's diffuse term has no 1/pi and Standard's BRDF does, so a rig
  // whose intensities were picked against Lambert renders Standard about pi
  // darker. This rig was picked against Lambert. The G35 arc already proved
  // that CHASING the game's pipeline here is a dead end — G36 replaced it
  // with "the editor renders in the game's own scene" — so this is
  // deliberately NOT that: one neutral gradient probe, enough that a
  // Standard material has something to reflect and the bench stays a usable
  // working surface.
  //
  // THE BENCH IS NOT WHERE THE LOOK IS JUDGED. The room is. Anything read
  // off this rig is a shape, not a colour.
  try {
    const g = document.createElement('canvas');
    g.width = 4; g.height = 64;
    const gx = g.getContext('2d');
    const gr = gx.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0.00, '#c8d8ec');            // sky
    gr.addColorStop(0.52, '#8b939c');            // horizon
    gr.addColorStop(1.00, '#2a2722');            // ground
    gx.fillStyle = gr; gx.fillRect(0, 0, 4, 64);
    const et = new THREE.CanvasTexture(g);
    et.mapping = THREE.EquirectangularReflectionMapping;
    et.encoding = THREE.sRGBEncoding;
    const pm = new THREE.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    scene.environment = pm.fromEquirectangular(et).texture;
    pm.dispose(); et.dispose();
    // AND NOTHING ELSE. Setting renderer.outputEncoding here would be the
    // obvious next step and it is the wrong one: it moves EVERY existing
    // bench page's authored colours, and G38's ruling is that the layers'
    // own tables and the bench's own look stay untouched. Adding an
    // environment is surgical by comparison — r128 routes scene.environment
    // to Standard/Physical materials ONLY, so the Lambert families that make
    // up the rest of the bench cannot see it and do not move.
  } catch (e) {}
}
let meshObj = null, cageObj = null, refObj = null, loopsObj = null;
let centre = new THREE.Vector3(), fitR = 3, centreOv = null;

const matCache = {};
// view transparency: THREE CONCEPTUAL FAMILIES (user 2026-08-19), each
// with its own alpha — fuselage (the exterior cage skin), interior SKIN
// (the sheet linings: plywood/toele/cloth/composite shell) and interior
// STRUCTURE (frames, posts, tubes, dash, bulkhead, firewall). Glass
// keeps its own alpha on top.
// glassA STARTS AT 1 (2026-08-31). It was 0.35 — a see-into-the-cabin
// default from before the glazing had a clarity dial of its own — and
// since matOf takes min(view, clarity), that default silently CAPPED every
// pane's material at 0.35 on every machine: clarity above it did nothing,
// and the flown snapshot baked the capped pane in. The view alpha is a way
// of LOOKING and still wins when it asks for less; a default that always
// asks for less was a cap wearing a preference's clothes.
const VIEW = { glassA: 1, bodyA: 1, skinA: 1, structA: 1, cowlA: 1,
               loops: 1, xray: 0 };
// layers read viewer state (the cowl layer's alpha) through this — G29
window.CAGE_VIEW = VIEW;
// SEE INSIDE (the user: "maybe we should have a view where the interior is
// visible, and not the fuselage, to be able to get to the engine and the
// cockpit through clicking"). One switch, and it is not a sixth alpha: the
// five dials each answer "how much of THIS family do I want to see through",
// and this answers a different question — "get the covering out of my way so
// I can work on what is under it". It therefore TAKES WHICHEVER ASKS FOR
// LESS — the rule the glazing already follows, so a builder who has dragged
// the fuselage below it keeps their own value — and it does the one thing no
// alpha does: what you can see through, you can also CLICK THROUGH. See `viewThru` below and the pick in
// src/viewer/app.js — a covering you can see the seats through and cannot
// click past is the same disappointment `cowl α` had before G113.4.
const XRAY_A = 0.12;
// ...and the layers take the same number from here rather than each picking
// their own: a cowl at 0.15 over a fuselage at 0.12 is two x-rays, and the
// eye reads the difference as the cowl still being there.
VIEW.xrayA = XRAY_A;
const GLASSM = new Set(['windshield', 'pilotWindow', 'pasengerWindow',
                        'skyWindows']);
const INTSKIN = new Set(['plywood', 'cloth', 'composite', 'toele']);
// boomTube = the G26 rod: it IS structure — fading the fuselage skin
// must leave the rod standing (the naked Ruckus test)
// taperPanel = the sheets bolted over the rod's tightening truss (G26). They
// are the TRUSS's own cladding, switched on by their own row, so a "no skin"
// build keeps them the way it keeps the tubes they are riveted to — the
// user's rod ultralight lost them at skinOn 0 and read as bare pipe (G187).
const INTSTRUCT = new Set(['bulkhead', 'firewall', 'fireProof', 'fireSeal',
                           'dash', 'dashFace', 'tube',
                           'woodFrame', 'aluminium', 'boomTube', 'taperPanel']);
// WHAT THE X-RAY TAKES AWAY, and what it must leave standing. It takes the
// COVERING — the outer skin, its glazing, and the interior linings that are
// the same covering seen from inside — because those are what stand between
// you and the cockpit. It leaves the STRUCTURE (frames, posts, tubes, the
// firewall, the bulkhead, the dash, the rod boom): an aeroplane with its skin
// off is a frame with an engine in it, not an empty outline, and the frame is
// half of what you came in to look at.
const xrayThru = name => !!VIEW.xray && !INTSTRUCT.has(name);
const xrayA = name => xrayThru(name) ? XRAY_A : 1;
const alphaOf = name =>
  Math.min(xrayA(name),
    GLASSM.has(name) ? Math.min(VIEW.glassA, VIEW.bodyA)
      : INTSKIN.has(name) ? VIEW.skinA
      : INTSTRUCT.has(name) ? VIEW.structA
      : VIEW.bodyA);
// the pick asks the same question the material did (src/viewer/app.js): one
// answer, so a section can never be see-through and still block a click
VIEW.thru = xrayThru;
const colOf = name => new THREE.Color(
  !$('color').checked ? '#b9c6d4' : (SEC[name] || '#5a6470'));

// AEROSKIN (G67). The bench's flat Lambert palette is still what a SECTION
// view wants — the section colours ARE the diagnostic, and G38's whole point
// was that colour should be the only variable while the loop was being
// validated ugly. So the material mode is a switch, and AEROSKIN is the other
// position of it:
//
//   sections   flat colour per SEC name (the palette, unchanged)
//   material   the finish for this section under the current construction,
//              with the section's colour tinting its albedo
//
// One factory for both worlds: the GAME's matFor calls the same
// aeroMaterial(), so the garage and the flown aeroplane are the same code and
// cannot drift. That is the answer to "the shaders used for the planes should
// be as consistent as possible".
const AK = () => (typeof window !== 'undefined' && window.AEROSKIN) || null;
const aeroOn = () => !!(AK() && $('mat') && $('mat').value === 'material');
// metres per unit of the field and of object space: the cage builds in its
// own units and the mesh is scaled by FS, so this is the one number that puts
// a 0.30 m weave at 0.30 m on screen (see uFieldM in aeroskin.js)
const fieldM = () => (G.CAGE_UNIT || 1) * (P.planeScale || 1);
// the construction the SKIN is made of. The cage's own interior model already
// carries this per section (cageInterior's consMap: 'carbon' | 'tube' |
// 'wood' | 'metal'), and its tokens are the ones GEN_MATERIALS uses under
// different names — the mapping is stated once, here.
// (cageSpec builds the same list from intCons; the internal token stays
// 'metal' and is NOT renamed casually — G14's ruling — while the material the
// player reads is 'aluminium')
const CONS_MAP = { tube: 'tubeFabric', wood: 'wood', metal: 'alloy',
                   carbon: 'carbon' };
// THE MEMBER SCREWS' NUMBERS (G214), metres, or null when hidden or when the
// construction has none to show (fabric is stitched, not screwed)
const memFOf = () => {
  if (!+P.memFast) return null;
  const c = consOf();
  if (c === 'tubeFabric') return null;
  return [+P.memPitch || 0.03, +P.memDia || 0.0025, +P.memRise || 0.0004];
};
const consOf = () => CONS_MAP[['carbon', 'tube', 'wood', 'metal'][
  Math.max(0, Math.min(3, Math.round(P.intCons || 0)))]] || 'tubeFabric';
// which section is on which shader branch — filled by meshFrom from the
// mesh's own groups, so there is ONE description of the split (G66)
const matSurf = {};
// THE PLAYER'S OWN CHOICES, per section: a colour (tinting the albedo) and a
// finish override. Both persist as one JSON pref, the shape G41's hangar
// parts already proved — one key, restores with the build.
const secTint = {};
const secFin = {};
// THE PER-SECTION DIALS (the user: "I'd want to be able to control scaling,
// roughness and normal/bump size for every material"). Multipliers on the
// finish's own numbers, so 1 is the material as designed and the finish table
// stays the authority on what a material IS. Absent means 1 and costs no
// storage: only the sections somebody has actually dialled are written.
const secTile = {}, secRough = {}, secNrm = {};
// G206: the sheen (clear coat) and the large-scale field, same shape
const secCc = {}, secField = {};
// G215: the metal flake in the paint, 0..1
const secMetal = {};
// THE PART'S OWN CONDITION (G114, answering G70's "no per-part condition"):
// a multiplier on the material's ageing rate, walked down the chains like
// the dials — the one dial still sets the aeroplane, this says how much of
// it each part shows. Absent means 1 and costs no storage.
const secWear = {};
// THE CONDITION OF THE AEROPLANE (G70). One number: 0 is the day it left the
// shop, 1 is twenty years on a grass strip. Everything it does and everywhere
// it lands is derived (see applyWear and aeroskin.js's THE WEAR) — this is
// the only thing anybody sets.
const WEAR = { amount: 0.0 };
const AERO_PREF = 'flydiy.aeroSections';
function aeroLoadPrefs() {
  try {
    const j = JSON.parse(localStorage.getItem(AERO_PREF) || '{}');
    Object.assign(secTint, j.tint || {});
    Object.assign(secFin, j.finish || {});
    Object.assign(secTile, j.tile || {});
    Object.assign(secRough, j.rough || {});
    Object.assign(secNrm, j.nrm || {});
    Object.assign(secWear, j.wearM || {});
    Object.assign(secCc, j.cc || {});
    Object.assign(secField, j.field || {});
    Object.assign(secMetal, j.metal || {});
    Object.assign(WEAR, j.wear || {});
    aeroLoadGlass(j);
  } catch (e) {}
}
// READ, MODIFY, WRITE — never write the whole key. This used to store
// `{tint, finish}` flat, which SILENTLY DELETED the decal block (G69 keeps
// its placement under `dec` in the same pref): changing one section's finish
// wiped where the registration sat, and you only found out after a reload.
// The wear block below would have been the second casualty.
// the glazing's dials come back with everything else — READ, MODIFY, WRITE,
// for the same reason the comment above gives
function aeroLoadGlass(j) {
  if (j && j.glass) for (const k in GLASS_DEFV)
    if (j.glass[k] !== undefined) GLASS[k] = j.glass[k];
}
function aeroSavePrefs() {
  try {
    const j = JSON.parse(localStorage.getItem(AERO_PREF) || '{}');
    j.tint = secTint; j.finish = secFin; j.wear = WEAR;
    j.tile = secTile; j.rough = secRough; j.nrm = secNrm;
    j.wearM = secWear; j.glass = GLASS;
    j.cc = secCc; j.field = secField; j.metal = secMetal;
    localStorage.setItem(AERO_PREF, JSON.stringify(j));
  } catch (e) {}
}
aeroLoadPrefs();

// ---------------------------------------------------------------------------
// RECENT COLOURS (G156)
// ---------------------------------------------------------------------------
// The user: "Remember recent picked colors in the livery editor." A livery is
// two or three colours used over and over — a fuselage, a trim, an accent —
// and every well opened the OS picker with no memory of them, so the same
// colour was hunted down again once per section.
//
// ONE STRIP, NOT ONE PER WELL. There are three kinds of colour well in this
// file (a section's tint, a marking's ink, a pane's glass) and thirty-odd
// instances of them; a swatch row under every one would be noise on every row
// and three implementations of one idea. This is a single element that MOVES
// to whichever well has the focus.
//
// IT IS THE PERSON'S, NOT THE AEROPLANE'S — its own key, the way `cageExpert`
// is, and deliberately not in the spec: which colours you reached for last is
// not a property of the aeroplane and must never ride a saved build.
//
// Positioned and sized INLINE rather than from editor.css, because the wells
// are borrowed into `#edRows` in the game and stand in `#cgUi` on the benches,
// and the picker itself hangs off #edWrap in one and <body> in the other.
// Keying its looks off a stylesheet only one of those loads is the G112
// mistake exactly.
const RECENT_PREF = 'flydiy.recentColours';
const RECENT_N = 12;
let RECENT = [];
const isHex = h => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
try {
  const j = JSON.parse(localStorage.getItem(RECENT_PREF) || '[]');
  if (Array.isArray(j)) RECENT = j.filter(isHex).slice(0, RECENT_N);
} catch (e) {}
function recentPush(hex) {
  if (!isHex(hex)) return;
  hex = hex.toLowerCase();
  RECENT = [hex].concat(RECENT.filter(h => h !== hex)).slice(0, RECENT_N);
  try { localStorage.setItem(RECENT_PREF, JSON.stringify(RECENT)); } catch (e) {}
}
// ---- THE PICKER (G187) --------------------------------------------------
// THE RECENT COLOURS LIVE INSIDE THE PICKER NOW (the user: "recent colours
// should be in the colour picker window"). An <input type=color> opens the OS
// dialog on its click, and that dialog has no DOM to put a swatch in — so the
// click is taken over (preventDefault stops the dialog) and a popup of our own
// opens instead: a saturation/value square, a hue bar, the hex, and the
// recent row. The hover strip that used to pre-empt the dialog is retired;
// its one job was to get the swatches in front of you before the dialog
// buried them, and now nothing buries them.
//
// IT IS HIDDEN WITH THE EDITOR. The old strip hung off <body> and closed on
// timers, so it OUTLIVED THE SCREEN: fly with a well hovered and the strip
// stayed up over the runway (the user: "it even survives the flight context,
// that's ridiculous"). The popup mounts under #edWrap when there is one, so
// `hidden` on the editor hides it too; app.js calls `CAGE_RECENT.hide()` on
// the switch as well; and a pointer down anywhere outside, Escape, a scroll
// of the column or the window losing focus all close it. On the benches
// (no #edWrap) it mounts on <body> as before.
//
// `input` fires live while dragging so the aeroplane follows; ONE `change`
// fires on commit (click outside, Enter, a swatch), which is what RECORDS a
// recent colour — the twenty shades passed on the way are never recorded.
// Escape puts the well back to the colour it opened with.
let pkEl = null, pkFor = null, pkHex0 = '', pkH = 0, pkS = 0, pkV = 0;
let pkSV = null, pkHue = null, pkHexIn = null, pkRow = null, pkDrag = null;
const PK_W = 180, PK_SVH = 118, PK_HH = 12;
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x =>
  Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
const rgbToHsv = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx > 1e-9 ? d / mx : 0, mx];
};
const hsvToRgb = (h, s, v) => {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const k = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [k[0] + m, k[1] + m, k[2] + m];
};
const pkHex = () => rgbToHex(...hsvToRgb(pkH, pkS, pkV));
function pkPaint() {
  if (!pkSV) return;
  const cs = pkSV.getContext('2d'), W = PK_W, H = PK_SVH;
  const [hr, hg, hb] = hsvToRgb(pkH, 1, 1);
  const gx = cs.createLinearGradient(0, 0, W, 0);
  gx.addColorStop(0, '#fff'); gx.addColorStop(1, rgbToHex(hr, hg, hb));
  cs.fillStyle = gx; cs.fillRect(0, 0, W, H);
  const gy = cs.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(1, '#000');
  cs.fillStyle = gy; cs.fillRect(0, 0, W, H);
  cs.beginPath(); cs.arc(pkS * W, (1 - pkV) * H, 5, 0, Math.PI * 2);
  cs.lineWidth = 2; cs.strokeStyle = pkV > 0.5 && pkS < 0.5 ? '#000' : '#fff';
  cs.stroke();
  const ch = pkHue.getContext('2d');
  const gh = ch.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 6; i++)
    gh.addColorStop(i / 6, rgbToHex(...hsvToRgb(i * 60 % 360, 1, 1)));
  ch.fillStyle = gh; ch.fillRect(0, 0, W, PK_HH);
  const hx = pkH / 360 * W;
  ch.fillStyle = '#fff'; ch.fillRect(hx - 1.5, 0, 3, PK_HH);
  ch.fillStyle = '#000'; ch.fillRect(hx - 0.5, 0, 1, PK_HH);
  if (pkHexIn && document.activeElement !== pkHexIn) pkHexIn.value = pkHex();
}
// the well takes the value; `input` only — `change` waits for the commit
function pkApply() {
  if (!pkFor) return;
  const h = pkHex();
  if (pkFor.value === h) return;
  pkFor.value = h;
  pkFor.dispatchEvent(new Event('input', { bubbles: true }));
}
function pkCommit() {
  const t = pkFor;
  pkHide();
  if (!t) return;
  if (t.value !== pkHex0)
    t.dispatchEvent(new Event('change', { bubbles: true }));
}
function pkRevert() {
  const t = pkFor;
  pkHide();
  if (!t || t.value === pkHex0) return;
  t.value = pkHex0;
  t.dispatchEvent(new Event('input', { bubbles: true }));
}
// `hidden` AND display: an inline `display:flex` outranks the attribute's UA
// rule, so the attribute alone left the popup on screen (measured: hidden
// true, computed display flex — it only vanished while #edWrap was gone)
function pkHide() {
  if (pkEl) { pkEl.hidden = true; pkEl.style.display = 'none'; }
  pkFor = null; pkDrag = null;
}
function pkSwatches() {
  pkRow.textContent = '';
  pkRow.style.display = RECENT.length ? 'flex' : 'none';
  if (!RECENT.length) return;
  for (const h of RECENT) {
    const b = document.createElement('button');
    b.type = 'button'; b.title = h;
    b.style.cssText = 'width:14px;height:14px;padding:0;border-radius:3px;' +
      'cursor:pointer;border:1px solid rgba(255,255,255,.28);background:' + h;
    b.onclick = () => {
      [pkH, pkS, pkV] = rgbToHsv(hexToRgb(h));
      pkApply(); pkCommit();
    };
    pkRow.appendChild(b);
  }
}
function pkBuild() {
  pkEl = document.createElement('div');
  pkEl.className = 'cgPicker';
  pkEl.style.cssText = 'position:fixed;z-index:60;display:none;flex-direction:' +
    'column;gap:6px;padding:6px;border-radius:6px;background:#1b1d21;' +
    'border:1px solid rgba(255,255,255,.16);box-shadow:0 4px 14px #0009;' +
    'width:' + (PK_W + 12) + 'px;user-select:none';
  pkEl.hidden = true;
  // a pointer down inside must not blur the well (the row's own listeners
  // key on it), and must not count as "outside"
  pkEl.addEventListener('mousedown', e => e.preventDefault());
  pkEl.addEventListener('pointerdown', e => e.stopPropagation());
  pkSV = document.createElement('canvas');
  pkSV.width = PK_W; pkSV.height = PK_SVH;
  pkSV.style.cssText = 'display:block;border-radius:4px;cursor:crosshair;' +
    'touch-action:none';
  pkHue = document.createElement('canvas');
  pkHue.width = PK_W; pkHue.height = PK_HH;
  pkHue.style.cssText = 'display:block;border-radius:3px;cursor:ew-resize;' +
    'touch-action:none';
  const drag = (cv, fn) => {
    const at = e => {
      const r = cv.getBoundingClientRect();
      fn(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
         Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
      pkPaint(); pkApply();
    };
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); pkDrag = cv;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      at(e);
    });
    cv.addEventListener('pointermove', e => { if (pkDrag === cv) at(e); });
    const up = () => { pkDrag = null; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  };
  drag(pkSV, (u, v) => { pkS = u; pkV = 1 - v; });
  drag(pkHue, (u) => { pkH = u * 360; });
  const line = document.createElement('div');
  line.style.cssText = 'display:flex;align-items:center;gap:6px';
  pkHexIn = document.createElement('input');
  pkHexIn.type = 'text'; pkHexIn.spellcheck = false; pkHexIn.maxLength = 7;
  pkHexIn.style.cssText = 'flex:1;min-width:0;font:11px/1.4 monospace;' +
    'padding:2px 5px;border-radius:3px;border:1px solid rgba(255,255,255,.2);' +
    'background:#111;color:#ddd';
  pkHexIn.addEventListener('input', () => {
    const t = pkHexIn.value.trim();
    if (!isHex(t)) return;
    [pkH, pkS, pkV] = rgbToHsv(hexToRgb(t));
    pkPaint(); pkApply();
  });
  pkHexIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); pkCommit(); }
    else if (e.key === 'Escape') { e.preventDefault(); pkRevert(); }
    e.stopPropagation();
  });
  const ok = document.createElement('button');
  ok.type = 'button'; ok.textContent = 'ok';
  ok.style.cssText = 'font:11px/1 sans-serif;padding:3px 8px;border-radius:3px;' +
    'border:1px solid rgba(255,255,255,.25);background:#2a2d33;color:#ddd;' +
    'cursor:pointer';
  ok.onclick = pkCommit;
  line.appendChild(pkHexIn); line.appendChild(ok);
  pkRow = document.createElement('div');
  pkRow.className = 'cgRecent';
  pkRow.style.cssText = 'display:none;flex-wrap:wrap;gap:3px';
  pkEl.appendChild(pkSV); pkEl.appendChild(pkHue);
  pkEl.appendChild(line); pkEl.appendChild(pkRow);
  const host = document.getElementById('edWrap') || document.body;
  host.appendChild(pkEl);
  // OUT OF CONTEXT = CLOSED: anything that is not the popup or its well
  document.addEventListener('pointerdown', e => {
    if (!pkFor || pkEl.hidden) return;
    if (e.target === pkFor || pkEl.contains(e.target)) return;
    pkCommit();
  }, true);
  document.addEventListener('keydown', e => {
    if (!pkFor || pkEl.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); pkRevert(); }
    else if (e.key === 'Enter') { e.preventDefault(); pkCommit(); }
  }, true);
  document.addEventListener('scroll', e => {
    if (pkFor && !pkEl.hidden && e.target !== pkSV && !pkEl.contains(e.target))
      pkCommit();
  }, true);
  window.addEventListener('blur', () => { if (pkFor) pkCommit(); });
}
function pkShow(input) {
  if (!pkEl) pkBuild();
  if (pkFor && pkFor !== input) pkCommit();
  pkFor = input;
  pkHex0 = isHex(input.value) ? input.value.toLowerCase() : '#000000';
  [pkH, pkS, pkV] = rgbToHsv(hexToRgb(pkHex0));
  pkSwatches();
  pkEl.hidden = false; pkEl.style.display = 'flex';
  pkPaint();
  // measured once it is laid out, then CLAMPED to the window: the wells live
  // in the right-hand column, and a popup hung from the left edge of one near
  // the bottom would hang off the screen. Flips above the well when needed.
  const r = input.getBoundingClientRect(), s = pkEl.getBoundingClientRect();
  const vw = window.innerWidth || s.width, vh = window.innerHeight || s.height;
  let x = r.left, y = r.bottom + 4;
  if (x + s.width > vw - 6) x = Math.max(6, vw - 6 - s.width);
  if (y + s.height > vh - 6) y = Math.max(6, r.top - 4 - s.height);
  pkEl.style.left = Math.round(x) + 'px';
  pkEl.style.top = Math.round(y) + 'px';
}
// EVERY well routes through this one call. The click that would open the OS
// dialog opens ours; Enter/Space on a focused well the same; `change` (ours,
// fired once on commit) is what RECORDS.
function wellRecent(c) {
  c.addEventListener('click', e => { e.preventDefault(); pkShow(c); });
  c.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pkShow(c); }
  });
  c.addEventListener('change', () => { recentPush(c.value); });
}
if (typeof window !== 'undefined')
  window.CAGE_RECENT = { push: recentPush, list: () => RECENT.slice(),
                         attach: wellRecent, hide: pkHide };
// THE LAYERS ASK AEROSKIN, AND AEROSKIN ASKS HERE (G70). The gear, engine,
// cowl and cabin layers must know whether the aeroplane is wearing its
// finishes or the diagnostic palette, and none of them owns this select —
// so the switch is published once instead of four modules reaching into a
// DOM element that belongs to this file.
if (typeof window !== 'undefined') window.CAGE_AERO_ON = aeroOn;

const matOf = name => {
  const a = alphaOf(name);
  if (aeroOn()) {
    const A = AK();
    // THE SECTION WEARS ITS MATERIAL UNTIL YOU PICK A COLOUR. The SEC palette
    // is a DIAGNOSTIC — magenta waistband, green pillars, chosen so sections
    // can be told apart — and it is not a livery. Defaulting the tint to it
    // would mean AEROSKIN's first impression is a harlequin, and it would
    // also apply the sRGB conversion to hexes that were picked without it.
    // So the stack starts where the user said it should: "base material from
    // the configurator, per section -> color picker tinting the albedo". No
    // pick, no tint — the finish's own colour, which is what doped fabric,
    // birch ply and alclad actually look like.
    const tint = secTint[name] != null ? secTint[name] : null;
    const key = 'a:' + name + ':' + a + ':' + (tint == null ? '-' : tint) +
                ':' + (secFin[name] || '') + ':' + consOf() +
                ':' + (secTile[name] || 1) + ':' + (secRough[name] || 1) +
                ':' + (secNrm[name] || 1) + ':' + (secWear[name] || 1) +
                ':' + (secCc[name] || 1) + ':' + (secField[name] || 1) +
                ':' + (secMetal[name] || 0) +
                ':' + (WEAR.amount || 0) + ':' + String(memFOf()) +
                // THE GLAZING DIALS JOIN THE KEY (2026-08-31, the user:
                // "none of the sliders do anything"). aeroGlass's own pool
                // states the rule — "EVERY DIAL JOINS THE KEY, or two panes
                // with different settings silently share one material" —
                // and this cache in FRONT of it never learned it: a moved
                // slider rebuilt into the same key and was handed the pane
                // it had already built. The dials never reached the stand.
                (A.AERO_GLASS.has(name)
                  ? ':G' + [GLASS.opacity, GLASS.scratch, GLASS.wipe,
                            GLASS.grime, GLASS.refl, GLASS.rainbow].join(',')
                  : '');
    if (matCache[key]) return matCache[key];
    if (A.AERO_GLASS.has(name)) {
      // the VIEW alpha still wins when it is asking for less: `glass a` is a
      // way of LOOKING at the build and must be able to see through it
      matCache[key] = A.aeroGlass(THREE, Object.assign({}, GLASS, {
        tint: secTint[name] != null ? secTint[name] : GLASS.tint,
        opacity: Math.min(a, GLASS.opacity),
        ext: GLASS_EXT[name] || [0, 0, 0, 0],
        // the condition dial reaches the glazing now, scaled by the pane's
        // own wear multiplier exactly as every other section's is
        wear: (WEAR.amount || 0) *
              (secWear[name] != null ? secWear[name] : 1),
        fieldM: fieldM() }));
    } else {
      matCache[key] = A.aeroMaterial(THREE, {
        // the construction picks the finish; the player's override wins
        finish: secFin[name] || A.aeroFinishFor(name, consOf()),
        // G68: the same construction also says how the structure SHOWS, and
        // only exterior skin carries it
        grm: consOf(), struct: A.aeroIsSkin(name) ? 1 : 0,
        tint, opacity: a, fieldM: fieldM(),
        // the three dials; absent is the finish's own number
        tileK: secTile[name], roughK: secRough[name], nrmK: secNrm[name],
        ccK: secCc[name], fieldK: secField[name],
        metalK: secMetal[name],                       // G215
        wearM: secWear[name],
        // G206.1: liners, frames, the dash and the fireproof sheet are in the
        // cabin; the exterior skin's back face is, by the factory's own rule
        inside: A.aeroIsInside && A.aeroIsInside(name) ? 1 : 0,
        // G207: a marking lands on the exterior skin and nowhere else
        decals: A.aeroDecOk ? A.aeroDecOk(name) : 1,
        // G214: the skin's screws along the real rings and rails — never on
        // a tube + fabric fuselage, which is stitched to its stringers
        memF: memFOf(),
        // the field is per-SECTION and pure (see _surf_check): the mesh
        // publishes which groups carry it, and meshFrom passes it in
        surf: matSurf[name] ? 1 : 0,
        side: THREE.DoubleSide,
      });
    }
    return matCache[key];
  }
  const neutral = !$('color').checked;
  const key = (neutral ? 'n:' : 'c:') + name + ':' + a;
  if (!matCache[key]) {
    matCache[key] = new THREE.MeshLambertMaterial({
      color: colOf(name),
      // glass is FRONT-SIDE only: with DoubleSide transparency the FAR
      // side of a curved pane rendered through the near one — its limb
      // read as a phantom circle on the bubble (user report). Interiors
      // + cutaway keep backfaces on everything else.
      side: GLASSM.has(name) ? THREE.FrontSide : THREE.DoubleSide,
      transparent: a < 1,
      opacity: a,
      depthWrite: a >= 1,          // translucent surfaces never occlude
    });
  }
  return matCache[key];
};

// THE LAYER SECTIONS' ONE-LINER (the per-part livery). The cage's sections
// come off the mesh's own groups; a LAYER's are declared in AEROSKIN's
// AERO_SEC and claimed here, at draw time, by the layer that owns them —
// which is what lets a wing follow the fuselage's paint and an aileron
// follow the wing's without either module knowing the other exists. The
// contract is gearMat's: null back means "draw what you drew before" (no
// AEROSKIN, material view off, or an undeclared name), so a standalone
// bench page keeps its flat palette.
//
// `g` carries GEOMETRY facts only — surf/fieldM/wing/ribM/struct/side/
// opacity, plus `cons` (the part's construction, phase B's per-part
// override rides in here) and `fin` (a layer-decided bottom-out finish,
// the propeller's material choice). The LOOKS come from the five override
// maps above, walked up the declared parent chain by aeroSecResolve — the
// same maps the cage rows write, so `spec.finish` carries these sections
// with no new machinery at all.
const SEC_LIVE = {};                    // section -> epoch it last drew in
const SEC_CTX = {};                     // section -> the g it last drew with
let SEC_EPOCH = 0;
const SEC_OVER = { fin: secFin, tint: secTint, tile: secTile,
                   rough: secRough, nrm: secNrm, wear: secWear,
                   cc: secCc, field: secField, metal: secMetal };
function secMat(name, g) {
  if (!aeroOn()) return null;
  const A = AK();
  if (!A || !A.AERO_SEC || !A.AERO_SEC[name] || !A.aeroSecResolve)
    return null;
  SEC_LIVE[name] = SEC_EPOCH;
  SEC_CTX[name] = g || {};
  const r = A.aeroSecResolve(name, SEC_OVER,
    { cons: (g && g.cons) || consOf(), fin: g && g.fin });
  return A.aeroMaterial(THREE, {
    // `tint0` is the LAYER'S legacy palette colour — the birch-vs-beech of a
    // blade, a spat's pale grey — used only when the whole walk says nothing:
    // an inherited colour beats a default, a default beats the finish base
    finish: r.fin,
    tint: r.tint != null ? r.tint
      : (g && g.tint0 != null) ? g.tint0 : null,
    wearK: g && g.wearK,
    grm: (g && g.cons) || consOf(),
    struct: g && g.struct ? 1 : 0,
    // THE CLASS PASSES THROUGH (G108). It was collapsed to a 0/1 flag here,
    // so the fin — which asks for class 2 — arrived as a wing and a marking
    // aimed at the fuselage-and-tail could not tell them apart.
    wing: (g && +g.wing) || 0,
    surf: g && g.surf ? 1 : 0,
    fieldM: (g && g.fieldM != null) ? g.fieldM : 1,
    ribM: g && g.ribM,
    // WHICH OBJECT AXIS IS LATERAL. In the cage's own frame it is x; the
    // flown model frame is z and app.js says so there. `uSideAxis` has
    // documented this since G69 and nothing ever passed it, so it was 0
    // everywhere by accident rather than by agreement — and the box
    // projector cannot be built on an accident.
    sideAxis: (g && g.sideAxis != null) ? g.sideAxis : 0,
    // the box-mapped microsurface passes straight through (G113.3)
    boxDet: g && g.boxDet ? 1 : 0,
    boxPlane: (g && +g.boxPlane) || 0,
    side: (g && g.side != null) ? g.side : THREE.DoubleSide,
    opacity: (g && g.opacity != null) ? g.opacity : 1,
    // `tileK0` is the LAYER'S own base scale (G125.1: a laminated blade wants
    // its glue lines at blade pitch, not fuselage pitch) — it COMPOSES with
    // the builder's dial, so the dial's 1.0 still means "as this part was
    // designed". `detRot` turns the triplanar grain a quarter: spanwise
    // laminations on a blade, from the same sheet the fuselage lays fore-aft.
    tileK: (r.tileK != null ? r.tileK : 1) * ((g && g.tileK0) || 1),
    roughK: r.roughK, nrmK: r.nrmK, wearM: r.wearM,
    ccK: r.ccK, fieldK: r.fieldK,                    // G206
    metalK: r.metalK,                                // G215
    // G206.1: the crew layer's sections (the seats, the dummies) sit inside
    inside: (A.AERO_SEC[name] && A.AERO_SEC[name].layer === 'crew') ? 1 : 0,
    // G207: the flying surfaces, the cowl and the spats take a marking; the
    // engine, the mount, the gear, the struts, the crew do not
    decals: A.aeroDecOk ? A.aeroDecOk(name) : 1,
    detRot: g && g.detRot ? 1 : 0,
  });
}
// the panel's view of the walk, for its own rows' labels and wells: the
// same resolver, over the same maps, with the ctx the layer last drew with
const secResolve = name => {
  const A = AK();
  const g = SEC_CTX[name] || {};
  return A.aeroSecResolve(name, SEC_OVER,
    { cons: g.cons || consOf(), fin: g.fin });
};
// ...and the AUTO label's view, which masks the section's OWN finish: the
// auto option describes what picking it would DO, and with an override set
// that is the reset — a row must never claim to be following itself
const secResolveAuto = name => {
  const A = AK();
  const g = SEC_CTX[name] || {};
  const fin2 = Object.assign({}, secFin);
  delete fin2[name];
  return A.aeroSecResolve(name,
    { fin: fin2, tint: secTint, tile: secTile, rough: secRough, nrm: secNrm,
      wear: secWear, cc: secCc, field: secField, metal: secMetal },
    { cons: g.cons || consOf(), fin: g.fin });
};
if (typeof window !== 'undefined') window.CAGE_SECMAT = secMat;

// THE SURFACE FIELD on the geometry (G66). aStruct = [sL, sC, st, lv] —
// metres along the body, metres around the section, station, rail. It is
// what replaces a UV unwrap: one metric coordinate, so a tiled material is
// the same real size on every surface, and the station/rail pair is where
// the fasteners and seams come from because the lattice IS the structure.
//
// Geometry with no lattice (the rim beads, the interior liners and frames —
// everything the post-passes ADD) reads (0,0,0,0) here and takes the
// shader's triplanar branch instead. That split is per-MATERIAL, never
// within one, and _surf_check.js asserts it: a material that mixed the two
// could not be drawn at all.
function surfAttr(m) {
  const n = m.V.length, a = new Float32Array(n * 4);
  const A = m.A;
  if (A) for (let i = 0; i < n; i++) {
    const q = A[i];
    if (!q) continue;
    a[i*4] = q[0]; a[i*4+1] = q[1]; a[i*4+2] = q[2]; a[i*4+3] = q[3];
  }
  return new THREE.BufferAttribute(a, 4);
}

function meshFrom(m) {
  // indexed geometry with per-material groups: welded verts give the same
  // smooth normals the game viewer computes
  const pos = new Float32Array(m.V.length * 3);
  m.V.forEach((v, i) => { pos[i*3] = v[0]; pos[i*3+1] = v[1]; pos[i*3+2] = v[2]; });
  const byMat = new Map();
  m.F.forEach(f => {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    const t = byMat.get(f.m);
    t.push(f.v[0], f.v[1], f.v[2], f.v[0], f.v[2], f.v[3]);
  });
  const idx = [], mats = [], groups = [];
  for (const [name, tris] of byMat) {
    groups.push([idx.length, tris.length, mats.length]);
    for (const i of tris) idx.push(i);
    mats.push(name);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aStruct', surfAttr(m));
  g.setIndex(idx);
  for (const [start, count, mi] of groups) g.addGroup(start, count, mi);
  g.computeVertexNormals();
  // which draw group is on which shader branch — the material factory reads
  // it instead of re-deriving it, so there is ONE description of the split.
  // ONE INDEX PER GROUP is enough, and deliberately so: _surf_check asserts
  // that every material is PURE (all its faces fielded, or none), which is
  // the invariant the shader needs anyway. Scanning the whole range instead
  // would be O(indices x groups) on every slider drag for an answer the
  // first vertex already gives.
  const surfMats = mats.map((nm, gi) => !!(m.A && m.A[idx[groups[gi][0]]]));
  mats.forEach((nm, gi) => { matSurf[nm] = surfMats[gi]; });
  // EACH PANE'S OWN EXTENT, in field units, measured off the drawn mesh
  // (G113.2). This is what makes "toward the edge" a real distance on a real
  // pane: the alternative is a screen-space edge detect, and dirt that moves
  // when the camera does is not dirt. Only the glass sections pay for it, and
  // only over their own indices — this runs on every rebuild.
  {
    const A0 = AK();
    for (const k in GLASS_EXT) delete GLASS_EXT[k];
    if (A0 && A0.AERO_GLASS && m.A) mats.forEach((nm, gi) => {
      if (!A0.AERO_GLASS.has(nm) || !surfMats[gi]) return;
      const [st, ct] = groups[gi];
      let lo0 = 1e9, lo1 = 1e9, hi0 = -1e9, hi1 = -1e9;
      for (let i = st; i < st + ct; i++) {
        const q = m.A[idx[i]];
        if (!q) continue;
        if (q[0] < lo0) lo0 = q[0];
        if (q[0] > hi0) hi0 = q[0];
        if (q[1] < lo1) lo1 = q[1];
        if (q[1] > hi1) hi1 = q[1];
      }
      const F = fieldM();
      if (hi0 > lo0) GLASS_EXT[nm] = [lo0 * F, lo1 * F, hi0 * F, hi1 * F];
    });
  }
  const mesh = new THREE.Mesh(g, mats.map(matOf));
  mesh.userData.surfMats = surfMats;
  mesh.userData.matNames = mats;
  // THE GLASS COMPANION (G206): every pane is two draws — the multiply pass
  // rides the same faces as a child mesh one renderOrder earlier. Inert when
  // the panes are not AEROSKIN glass (the flat view), tagged so the join and
  // the highlight walk past it. See aeroskin.js's glass family header.
  {
    const A0 = AK();
    if (A0 && A0.aeroGlassCompanion)
      A0.aeroGlassCompanion(THREE, mesh, mesh.material, m0 =>
        A0.aeroGlassTint(THREE, { tintLin: m0.color.getHex(),
                                  opacity: m0.opacity }));
  }
  return mesh;
}

// THE FIELD, SEEN (G66). A 0.25 m checkerboard straight off (sL, sC): if the
// field is metric and unstretched the squares are squares, everywhere, at
// every station — which is the whole claim, and the cheapest way to falsify
// it is to look. The station/rail mode draws the lattice instead: integer
// stations and rails solid, GUARDS IN RED, because a guard is a
// Catmull-Clark pinning loop and no aeroplane has a former there — a red
// line where a rivet row will go is the bug this mode exists to catch.
// Unlit on purpose: this is a diagnostic, not a material.
const SURF_TILE = 0.25;
function surfMesh(m, mode) {
  const mesh = meshFrom(m);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTile: { value: SURF_TILE }, uMode: { value: mode === 'grid' ? 1 : 0 } },
    vertexShader: `
      attribute vec4 aStruct;
      varying vec4 vS; varying vec3 vN;
      void main() {
        vS = aStruct;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uTile; uniform int uMode;
      varying vec4 vS; varying vec3 vN;
      // a line AT every integer of x, one pixel wide whatever the zoom
      float atInt(float x) {
        float d = abs(x - floor(x + 0.5));
        return 1.0 - smoothstep(0.0, fwidth(x) * 1.2, d);
      }
      void main() {
        float lit = 0.45 + 0.55 * abs(normalize(vN).z);
        vec3 c;
        if (uMode == 1) {
          // THE LATTICE. A line at every integer station (blue) and every
          // integer rail (orange) — and NOTHING on a guard, because a guard
          // is a Catmull-Clark pinning loop and no aeroplane has a former
          // there. So the diagnostic is a line that should not exist: a
          // guard wrongly given an integer shows up as a DOUBLED line
          // beside a pillar, which is exactly the bug that would put a
          // rivet row on a subdivision artefact.
          c = vec3(0.16, 0.18, 0.22);
          c = mix(c, vec3(0.35, 0.80, 1.00), atInt(vS.z));
          c = mix(c, vec3(1.00, 0.75, 0.25), atInt(vS.w));
        } else {
          // the metric checker
          vec2 t = vec2(vS.x, vS.y) / uTile;
          float ck = mod(floor(t.x) + floor(t.y), 2.0);
          c = mix(vec3(0.20, 0.23, 0.28), vec3(0.78, 0.80, 0.84), ck);
          // the datum lines: sL = 0 is the FIREWALL, sC = 0 is the WAIST rail
          c = mix(c, vec3(0.2, 1.0, 0.4),
                  1.0 - smoothstep(0.0, fwidth(vS.x) * 1.5, abs(vS.x)));
          c = mix(c, vec3(1.0, 0.3, 0.8),
                  1.0 - smoothstep(0.0, fwidth(vS.y) * 1.5, abs(vS.y)));
        }
        // no field at all (the rim beads, the liners): flat grey, and it
        // should look like a DIFFERENT thing, because it is
        if (vS == vec4(0.0)) c = vec3(0.30, 0.28, 0.26);
        gl_FragColor = vec4(c * lit, 1.0);
      }`,
  });
  mesh.material = mesh.material.map(() => mat);
  return mesh;
}

// QUAD WIREFRAME (user 2026-08-19: "not triangulated, only quad topo").
// material.wireframe draws the TRIANGULATION the renderer needs — this
// walks the real face cycles instead, one LineSegments per material so
// the section colours and the family alphas still apply.
function quadWire(m) {
  const g = new THREE.Group();
  const byMat = new Map();
  for (const f of m.F) {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    byMat.get(f.m).push(f);
  }
  for (const [name, faces] of byMat) {
    const seen = new Set(), pos = [];
    for (const f of faces) {
      const vs = f.v;
      for (let k = 0; k < vs.length; k++) {
        const a = vs[k], b = vs[(k + 1) % vs.length];
        if (a === b) continue;                  // self-edge convention
        const key = a < b ? a + '_' + b : b + '_' + a;
        if (seen.has(key)) continue;
        seen.add(key);
        const A = m.V[a], B = m.V[b];
        pos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
      }
    }
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(pos), 3));
    const a = alphaOf(name);
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: colOf(name), transparent: a < 1, opacity: a })));
  }
  return g;
}

function curvatureMesh(m) {
  // non-indexed, per-face heat colour by max dihedral to neighbours
  const N = m.F.map(f => {
    const p = f.v.map(i => m.V[i]);
    const u = [p[1][0]-p[0][0], p[1][1]-p[0][1], p[1][2]-p[0][2]];
    const w = [p[3][0]-p[0][0], p[3][1]-p[0][1], p[3][2]-p[0][2]];
    const n = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0]/l, n[1]/l, n[2]/l];
  });
  const EF = new Map();
  m.F.forEach((f, fi) => {
    for (let k = 0; k < 4; k++) {
      const a = f.v[k], b = f.v[(k+1)%4], key = a < b ? a+'_'+b : b+'_'+a;
      if (!EF.has(key)) EF.set(key, []);
      EF.get(key).push(fi);
    }
  });
  const dih = new Float32Array(m.F.length);
  for (const l of EF.values()) if (l.length === 2) {
    const d = Math.max(-1, Math.min(1,
      N[l[0]][0]*N[l[1]][0] + N[l[0]][1]*N[l[1]][1] + N[l[0]][2]*N[l[1]][2]));
    const a = Math.acos(d) * 180 / Math.PI;
    if (a > dih[l[0]]) dih[l[0]] = a;
    if (a > dih[l[1]]) dih[l[1]] = a;
  }
  const pos = [], col = [];
  m.F.forEach((f, fi) => {
    const a = Math.min(1, dih[fi] / 16);
    const r = 0.16 + 0.84 * Math.min(1, a * 2);
    const gg = 0.47 + 0.4 * (1 - a) - 0.35 * Math.max(0, a * 2 - 1);
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const v = m.V[f.v[i]];
      pos.push(v[0], v[1], v[2]);
      col.push(r, Math.max(0.08, gg), 0.12);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

function edgeLines(m, color, opacity) {
  const seen = new Set(), pos = [];
  for (const f of m.F || []) {
    const vs = f.v || f;
    for (let k = 0; k < vs.length; k++) {
      const a = vs[k], b = vs[(k+1)%vs.length];
      const key = a < b ? a+'_'+b : b+'_'+a;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = m.V[a], B = m.V[b];
      pos.push(A[0], A[1], A[2], B[0], B[1], B[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity }));
}

function disposeObj(o) {
  if (!o) return;
  o.traverse ? o.traverse(c => { if (c.geometry) c.geometry.dispose(); }) : 0;
  scene.remove(o);
}

// ---- the measurement pane + box -------------------------------------------
// The plane's own size, read off the DISPLAYED geometry's bounding box
// (so canopies, cut parts and the nose cap all count) in the world units
// CAGE_UNIT defines. Metres and feet-inches, because an aeroplane is
// quoted in both. The box is a display option; the pane is always on.
let dimsEl = null, dimsBox = null;
// AS-BUILT measure: a cut part flying out on `explode` must not change
// the aeroplane's dimensions, so every vertex is measured back at its
// own part's place (the faces carry their translation as cutOff).
// EXTERIOR ONLY — seals and interior linings ride an exploded door
// without recording the move, and they are inside the skin anyway, so
// they can never be what sets a dimension.
function measureBox(m, FS) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  const seen = new Set();
  for (const f of m.F) {
    if (f.m === 'joint' || f.m === 'doorSeal' || f.m === 'paneEdge' ||
        INTSKIN.has(f.m) || INTSTRUCT.has(f.m)) continue;
    const o = f.cutOff || [0, 0, 0];
    for (const vi of f.v) {
      const key = vi + ':' + (f.cutOff ? 1 : 0);
      if (seen.has(key)) continue;
      seen.add(key);
      const v = m.V[vi];
      for (let c = 0; c < 3; c++) {
        const p = (v[c] - o[c]) * FS;
        if (p < lo[c]) lo[c] = p;
        if (p > hi[c]) hi[c] = p;
      }
    }
  }
  if (lo[0] > hi[0]) return null;
  return new THREE.Box3(new THREE.Vector3(lo[0], lo[1], lo[2]),
                        new THREE.Vector3(hi[0], hi[1], hi[2]));
}
function fmtLen(m) {
  const ti = Math.round(m / 0.0254);           // total inches
  const ft = Math.floor(ti / 12), inch = ti % 12;
  return { m: m.toFixed(2) + ' m', imp: ft + '′ ' + inch + '″',
           inch: ti + '″' };
}
function updateDims(box, FS) {
  if (!dimsEl || !box) return;
  const sz = box.getSize(new THREE.Vector3());
  const row = (label, v) => {
    const f = fmtLen(v);
    return '<div style="display:flex;gap:9px;align-items:baseline">' +
      '<span style="width:46px;color:#7d8996">' + label + '</span>' +
      '<b style="width:58px;font-weight:500">' + f.m + '</b>' +
      '<span style="width:56px;color:#5db3ff">' + f.imp + '</span>' +
      '<span style="color:#4a525c">' + f.inch + '</span></div>';
  };
  const sc = (P.planeScale != null ? P.planeScale : 1);
  dimsEl.innerHTML =
    '<div style="color:#7d8996;letter-spacing:.14em;font-size:9px;' +
    'margin-bottom:4px">DIMENSIONS</div>' +
    row('length', sz.z) + row('width', sz.x) + row('height', sz.y) +
    '<div style="color:#4a525c;margin-top:4px;font-size:10px">1 cage unit = ' +
    (G.CAGE_UNIT || 1).toFixed(3) + ' m  ·  scale ×' + sc.toFixed(3) +
    '</div>';
  disposeObj(dimsBox); dimsBox = null;
  if ($('dimsBox') && $('dimsBox').checked) {
    dimsBox = new THREE.Box3Helper(box.clone(), 0x5db3ff);
    dimsBox.material.transparent = true;
    dimsBox.material.opacity = 0.55;
    scene.add(dimsBox);
  }
}

// ---- build ----------------------------------------------------------------
function build() {
  // FOREVER-SPLIT (user ruling): with the pod on, any aft param still
  // at its sentinel takes a ONE-SHOT copy of the front's current value
  // — from then on the halves are independent, and moving a nose
  // slider never drags the aft deck again. Sliding an aft param back
  // below its threshold re-copies once: the "match the front now"
  // gesture.
  if (P.mirror && G.CAGE_AFT_SUB) {
    let ch = false;
    for (const [ak, fk, thr] of G.CAGE_AFT_SUB)
      if (P[ak] != null && P[ak] < thr && P[fk] != null) {
        P[ak] = P[fk]; ch = true;
      }
    if (ch) syncSliders();
  }
  const stepSel = $('step') ? $('step').value : (PAGE.defaultStep || 'crease');
  const step = stepSel === 'crease' ? 'crease' : +stepSel;
  const spec = G.cageSpec({ ...P });
  const m = G.buildCage2(spec, step);
  M0 = m;
  let s = m;
  const L = +$('lvl').value;
  for (let i = 0; i < L; i++) s = G.cageSubdivide(s);
  // rim joints sweep the boundary of the mesh AT THIS level — they stick
  // to the displayed surface exactly, at any subsurf setting
  // glass sill first: rows under the pilot/pax glass reassign to glass
  // so the cut and the joints see the extended windows
  if (step === 'crease' && G.cageGlassSill) s = G.cageGlassSill(s, spec);
  // G14: cut doors/windows into separate parts BEFORE the rims, so the
  // joints are traced on (and travel with) the moved panels
  if (step === 'crease' && G.cageCut) s = G.cageCut(s, spec);
  // the bubble canopy: a post-subdivision component on the displayed
  // seam — before the rims so it gets its frame seal
  if (step === 'crease' && G.cageCanopy) s = G.cageCanopy(s, spec);
  if (step === 'crease') s = G.cageRims(s, spec);
  // interior elements are disjoint post-passes too (G13)
  if (step === 'crease' && G.cageInterior) s = G.cageInterior(s, spec);
  MS = s;

  disposeObj(meshObj);
  for (const k in matCache) delete matCache[k];
  // ZERO SKIN (G26.4, user): beyond the alpha slider — with skinOn 0
  // BOTH skin families (the fuselage: skin, pillar bands, taper
  // section, taper panels, cut doors — AND the interior linings:
  // cloth, toele, plywood sheets, the composite shell) are omitted
  // from the DISPLAYED mesh outright: what remains is glass, joints
  // and the bare structure (the closed-liner rework makes the
  // structural members stand on their own). The layers (fin/gear/
  // crew) and the measurements still see the full mesh.
  const skinCull = name => !GLASSM.has(name)
    && !INTSTRUCT.has(name) && name !== 'joint' && name !== 'doorSeal'
    && name !== 'paneEdge';
  const sd0 = (P.skinOn == null || P.skinOn) ? s
    : { ...s, F: s.F.filter(f => !skinCull(f.m)) };
  // GLAZING OFF (2026-09-04): the glass faces go the same way the skin does
  const sd = (P.glazeOn == null || +P.glazeOn) ? sd0
    : { ...sd0, F: sd0.F.filter(f => !GLASSM.has(f.m) && f.m !== 'paneEdge') };
  const surfSel = $('surf') ? $('surf').value : 'off';
  meshObj = (surfSel !== 'off') ? surfMesh(sd, surfSel)
    : ($('curv') && $('curv').checked) ? curvatureMesh(sd)
    : ($('wire') && $('wire').checked) ? quadWire(sd) : meshFrom(sd);
  // THE UNIT (see CAGE_UNIT in _cage_gen.js): metres = cage x CAGE_UNIT
  // x planeScale. The cage scales; crew scenery is already metric and
  // never does. Pages without the param build at the unit exactly.
  const FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  // THE BODY ZONES RIDE WITH THE MESH (see cageBodyZones in _cage_gen.js).
  // The covering is ONE material, so which SECTION of the aeroplane a piece
  // of skin belongs to is a question about stations, not about draw groups —
  // and the answer travels on the object that carries the skin, in the same
  // coordinates its positions are in (cage units, before FS), so a reader
  // needs the mesh and nothing else.
  meshObj.userData.bodyZones = G.cageBodyZones ? G.cageBodyZones(spec) : null;
  meshObj.scale.setScalar(FS);
  scene.add(meshObj);

  disposeObj(cageObj); cageObj = null;
  if ($('cage').checked && L > 0) {
    cageObj = new THREE.Group();
    cageObj.add(edgeLines(m, 0xffbe5a, 0.85));
    cageObj.scale.setScalar(FS);
    scene.add(cageObj);
  }

  // canopy CONTROL LOOPS overlay (user ask: the loops must be visible,
  // hideable in the view panel) — drawn always-on-top in loop colours
  disposeObj(loopsObj); loopsObj = null;
  if (VIEW.loops && s.canArcs && s.canArcs.length) {
    loopsObj = new THREE.Group();
    const cols = [0xffd24a, 0x4af0ff, 0xff7ad9];
    s.canArcs.forEach((arc, i) => {
      const pos = [];
      for (const p of arc) pos.push(p[0], p[1], p[2]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({
        color: cols[i % cols.length], depthTest: false,
        transparent: true, opacity: 0.9 }));
      l.renderOrder = 5;
      loopsObj.add(l);
    });
    loopsObj.scale.setScalar(FS);
    scene.add(loopsObj);
  }

  // fit
  const box = new THREE.Box3().setFromObject(meshObj);
  box.getCenter(centre);
  fitR = box.getSize(new THREE.Vector3()).length() * 0.62;
  updateDims(measureBox(s, FS), FS);

  $('stat').textContent =
    `cage ${m.V.length} v / ${m.F.length} q  →  L${L}: ` +
    `${s.V.length} v / ${s.F.length} q`;
  // The materials panel lists the sections THIS build actually has. Guarded
  // because build() runs during boot, BEFORE the panel's own host elements
  // exist — and they are const/let, so reaching them early is a temporal
  // dead zone throw, not an undefined. (`node --check does not catch
  // scoping; the probe run does` — this file's own lesson, twice over.)
  // decRange BEFORE applyDecals: the sliders' bounds are the build's own
  // extent, and the build has just changed
  // A SWALLOWED BUILD ERROR IS WORSE THAN A LOUD ONE. This catch is here so
  // one panel failing cannot take the whole rebuild with it — which is right
  // — but it said nothing, and a decal panel that came up EMPTY looked like a
  // layout bug for ten minutes before anyone thought to ask whether it had
  // thrown. It still swallows; it just says so first.
  // THE CRAFT FRAME, before anything is placed in it. The cage's own axes are
  // x lateral, z forward, y up; `aft` flips the along axis so a station means
  // the same thing here as it does in the surface field.
  try {
    const A0 = AK(), root = (typeof window !== 'undefined') && window.CAGE_UI_SCENE;
    if (A0 && A0.aeroSetCraft && root) {
      root.updateWorldMatrix(true, false);
      A0.aeroSetCraft(THREE, root.matrixWorld,
                      { lateral: 'x', along: 'z', up: 'y', aft: true });
    }
    // THE CABIN'S DARKNESS FOLLOWS THE GLAZING (G206.1): a glazed cabin
    // keeps the lab's whole darkness, an open one (no pane drawn) keeps
    // less — there is still a combing and a floor over it
    if (A0 && A0.aeroSetCabin)
      A0.aeroSetCabin(THREE, { coverage: Object.keys(GLASS_EXT).length ? 1 : 0.4 });
  } catch (e) {}
  try { buildMatPanel(); decRange(); decApplyRanges(); applyDecals(); }
  catch (e) { console.error('CAGE_UI: the finish panels did not build —', e); }
  // page post hook (cage5 crew layer): extra scene content rebuilt after
  // every cage build — additive, pages without it are unaffected.
  // LAYERS SEE THE AEROPLANE AS-BUILT (G29): exploded cut parts carry
  // their translation as cutOff — the DISPLAY keeps the offsets, but the
  // contracts (gear stance, fin/stab decks, the engine face) must never
  // move with a flying door (user: the undercarriage followed `explode`)
  let sFix = s;
  if ((P.explodeD || 0) > 0) {
    const V2 = s.V.map(p => p.slice());
    const undone = new Set();
    for (const f of s.F) if (f.cutOff)
      for (const vi of f.v) {
        if (undone.has(vi)) continue;
        undone.add(vi);
        V2[vi] = [V2[vi][0] - f.cutOff[0], V2[vi][1] - f.cutOff[1],
                  V2[vi][2] - f.cutOff[2]];
      }
    sFix = Object.assign({}, s, { V: V2 });
  }
  // THE LAYER SECTIONS ARE CLAIMED INSIDE THE POST HOOK, which runs AFTER
  // the materials panel above was built — so the epoch turns over here, the
  // layers stamp SEC_LIVE as they draw, and the panel gets a SECOND look
  // below. Cheap by construction: buildMatPanel's signature check makes the
  // second call a no-op on every build where no layer appeared or vanished.
  SEC_EPOCH++;
  if (PAGE.post) try { PAGE.post({ scene, spec, mesh: sFix, P, stat: $('stat') }); }
  catch (e) { console.error('page post hook:', e); }
  for (const k in SEC_LIVE)
    if (SEC_LIVE[k] !== SEC_EPOCH) { delete SEC_LIVE[k]; delete SEC_CTX[k]; }
  try { buildMatPanel(); } catch (e) {}
  // THE WEAR IS MEASURED AFTER THE LAYERS, and it has to be: its two sources
  // are the exhaust exit and the wheel, and neither exists until the engine
  // and gear layers have run. `s`, not `sFix` — the field belongs to the
  // aeroplane as built, and an exploded door has not moved on its own skin.
  try { applyWear(s, FS); } catch (e) { console.error('wear:', e); }
  // `when` rows follow their discriminators live (P just changed)
  applyRowVis();
  draw();
}

function draw() {
  // EXT: the game's loop renders the shared scene; ping the mount so the
  // sit transform follows every rebuild (pitch/gy move with the gear)
  if (!renderer) {
    if (window.CAGE_ON_BUILD) window.CAGE_ON_BUILD();
    return;
  }
  const r = cv.parentElement.getBoundingClientRect();
  const dp = devicePixelRatio || 1;
  renderer.setSize(r.width * dp, r.height * dp, false);
  cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  const R = fitR / ZOOM;
  const C = centreOv || centre;
  camera.position.set(
    C.x + R * Math.sin(yaw) * Math.cos(pitch),
    C.y + R * Math.sin(pitch),
    C.z + R * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(C);
  renderer.render(scene, camera);
}

// ---- ghost reference ------------------------------------------------------
let REF = null, REF_STEP = -1;
function loadRef() {
  if (!$('refOn')) return;               // page has no ghost-ref controls
  const sel = $('step') ? $('step').value : 'crease';
  const step = sel === 'crease' ? 1 : +sel;
  disposeObj(refObj); refObj = null;
  if (!$('refOn').checked) { draw(); return; }
  const attach = () => {
    disposeObj(refObj);
    refObj = edgeLines(REF, 0xff7850, 0.1 + 0.45 * +$('refA').value);
    scene.add(refObj);
    draw();
  };
  if (REF_STEP === step && REF) { attach(); return; }
  fetch('_cage_ref_' + step + '.obj')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(txt => {
      const V = [], F = [];
      for (const line of txt.split('\n')) {
        if (line.startsWith('v ')) {
          const p = line.trim().split(/\s+/);
          V.push([+p[1], +p[2], +p[3]]);
        } else if (line.startsWith('f ')) {
          F.push({ v: line.trim().split(/\s+/).slice(1)
            .map(t => parseInt(t.split('/')[0], 10) - 1) });
        }
      }
      REF = { V, F }; REF_STEP = step;
      attach();
    })
    .catch(e => { $('stat').textContent = 'ref failed: ' + e.message; });
}

// ---- ui -------------------------------------------------------------------
const ui = $('cgUi') || $('ui');
// G28: panel chrome, injected AFTER the page's stylesheet so it wins —
// a wider label column (ellipsis keeps rows one-line; every label also
// carries its full text as a tooltip), and VISIBLE NESTING: top-level
// groups keep their box, nested groups trade the box for an indent and
// a guide line, so the level is readable at a glance.
{
  const st = document.createElement('style');
  st.textContent = `
    #ui .r span.k{width:118px}
    #ui details details{border:none;border-left:2px solid #2a3140;
      border-radius:0;padding:1px 0 1px 9px;margin:6px 0 6px 2px}
    #ui details[open]>summary{color:#aab6c2}
  `;
  document.head.appendChild(st);
}
// A REAL RESIZE HANDLE (user, asked twice — the aside's CSS corner
// resize was invisible and awkward): a full-height grip on the panel's
// left edge, width persisted across sessions and pages.
{
  ui.style.resize = 'none';
  try {
    const w = parseInt(localStorage.getItem('cagePanelW') || '', 10);
    if (w >= 240 && w <= innerWidth * 0.7) ui.style.width = w + 'px';
  } catch (e) {}
  const grip = document.createElement('div');
  grip.style.cssText = 'flex:none;width:7px;cursor:col-resize;' +
    'background:linear-gradient(90deg,transparent 2px,#242a33 2px,' +
    '#242a33 5px,transparent 5px)';
  if (ui.parentElement) ui.parentElement.insertBefore(grip, ui);
  let gd = null;
  grip.addEventListener('mousedown', e => {
    gd = [e.clientX, ui.getBoundingClientRect().width];
    e.preventDefault();
  });
  addEventListener('mousemove', e => {
    if (!gd) return;
    ui.style.width = Math.max(240, Math.min(innerWidth * 0.7,
      gd[1] + (gd[0] - e.clientX))) + 'px';
    draw();
  });
  addEventListener('mouseup', () => {
    if (!gd) return;
    gd = null;
    try { localStorage.setItem('cagePanelW',
      String(Math.round(ui.getBoundingClientRect().width))); }
    catch (e) {}
  });
}
// THE ROW GRAMMAR (P1, 2026-08-26): the widget is a PROPERTY OF THE
// PARAMETER, inferred here from the declared range — pages declare
// [key, label, lo, hi, step, names?, opts?] and never pick a widget:
//   0..1 step 1, or a two-name list      -> checkbox
//   a names list of 3+                   -> dropdown
//   integer step spanning <= 8 stops     -> stepper (− n +)
//   everything else                      -> slider + TYPED value field,
//                                           double-click label = reset to
//                                           the loaded design's value
// The interactive element keeps id `p_<key>` and stays a DIRECT child of
// the .r row — the cowl layer's lock/hide pass styles rows through exactly
// that contract (el.disabled + el.parentElement), and it must keep working.
// opts, all optional:
//   when:     P => bool — the row exists only when true (rec §2; re-run
//             after every build, so a discriminator reveals its rows live)
//   level:    'expert' — hidden unless the expert switch is on
//   dim:      'len' — value is cage units; show ≈ metres after planeScale
//   copyFrom: 'frontKey' — renders an "= front" button: the FOREVER-SPLIT
//             one-shot gesture made visible (the ruling itself unchanged —
//             the halves stay independent after the copy)
//   link:     {sentinel, from, test?} — live "follows" checkbox: checked
//             writes the sentinel (the layer keeps resolving it live),
//             unchecked writes the currently-effective value back
const ROWMETA = [];
const GROUPMETA = [];
const EXPERT = { on: false };
try { EXPERT.on = localStorage.getItem('cageExpert') === '1'; } catch (e) {}
const fmtV = v => (+v).toFixed(3);
const mkRow = (parent, k, label, lo, hi, st, val, oninput, names, opts) => {
  opts = opts || {};
  const d = document.createElement('div'); d.className = 'r';
  const meta = { k, lo, hi, st, names, opts, row: d };
  ROWMETA.push(meta);
  const kSpan = document.createElement('span');
  kSpan.className = 'k'; kSpan.textContent = label;
  kSpan.title = label;               // ellipsized labels stay readable
  d.appendChild(kSpan);
  parent.appendChild(d);
  const rel = k === 'planeScale';
  const isTwoNames = !!names && names.length === 2;
  const isCheck = isTwoNames ||
    (!names && lo === 0 && hi === 1 && st === 1);
  const isStep = !names && !isCheck && Number.isInteger(lo) &&
    Number.isInteger(hi) && Number.isInteger(st) && st >= 1 &&
    (hi - lo) / st <= 8;
  let widget = null;                     // the p_<k> element
  if (names && !isTwoNames) {            // ---- dropdown ----
    meta.kind = 'select';
    const sel = document.createElement('select');
    sel.id = 'p_' + k; sel.style.flex = '1';
    // optLabels (G187): what the option SAYS, when that is more than the
    // name — an array or a function returning one, read at build time so a
    // page can join in facts from files bundled after its own. `names` stays
    // the key list and the value stays its index.
    const shown = typeof opts.optLabels === 'function' ? opts.optLabels()
                : opts.optLabels;
    // optOrder (2026-09-06): the ORDER the options are shown in — a function
    // returning the indices in display order. The value is still the index
    // into `names`, so a saved number never changes meaning; only the list
    // reads differently (the engine row reads by power).
    let order = names.map((n, i) => i);
    if (typeof opts.optOrder === 'function') {
      try { const o = opts.optOrder(); if (Array.isArray(o) && o.length === names.length) order = o; }
      catch (e) {}
    }
    sel.innerHTML = order.map(i =>
      `<option value="${i}"${+val === i ? ' selected' : ''}>` +
      `${(shown && shown[i]) || names[i]}</option>`)
      .join('');
    d.appendChild(sel);
    sel.onchange = e => oninput(+e.target.value);
    widget = meta.el = sel;
  } else if (isCheck) {                  // ---- checkbox ----
    meta.kind = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = 'p_' + k; cb.style.flex = 'none';
    cb.checked = +val >= 1;
    d.appendChild(cb);
    let vs = null;
    if (isTwoNames) {                    // show the active state's name
      vs = document.createElement('span');
      vs.className = 'v'; vs.id = 'v_' + k;
      vs.style.cssText = 'width:auto;flex:1;text-align:left';
      vs.textContent = names[cb.checked ? 1 : 0];
      d.appendChild(vs);
    }
    cb.onchange = () => {
      if (vs) vs.textContent = names[cb.checked ? 1 : 0];
      oninput(cb.checked ? 1 : 0);
    };
    widget = meta.el = cb; meta.vs = vs;
  } else if (isStep) {                   // ---- stepper ----
    meta.kind = 'step';
    const bm = document.createElement('button'); bm.textContent = '−';
    const inp = document.createElement('input');
    inp.id = 'p_' + k; inp.className = 'v';
    inp.type = 'text'; inp.inputMode = 'numeric';
    inp.style.cssText = 'background:#1a1f27;border:1px solid #242a33;' +
      'border-radius:4px;color:#5db3ff;padding:1px 3px;font:inherit;' +
      'text-align:right';
    inp.value = String(+val);
    const bp = document.createElement('button'); bp.textContent = '+';
    d.appendChild(bm); d.appendChild(inp); d.appendChild(bp);
    const put = v => {
      v = Math.max(lo, Math.min(hi, v));
      inp.value = String(v);
      oninput(v);
    };
    bm.onclick = () => { if (!inp.disabled) put(+inp.value - st); };
    bp.onclick = () => { if (!inp.disabled) put(+inp.value + st); };
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (Number.isFinite(v)) put(lo + Math.round((v - lo) / st) * st);
      else inp.value = String(P[k] != null ? P[k] : val);
    };
    widget = meta.el = inp;
  } else {                               // ---- slider + typed value ----
    meta.kind = 'slider';
    const rng = document.createElement('input');
    rng.type = 'range'; rng.id = 'p_' + k;
    rng.min = lo; rng.max = hi; rng.step = st;
    rng.value = rel ? relSize() : val;
    const vf = document.createElement('input');
    vf.id = 'v_' + k; vf.className = 'v';
    vf.type = 'text'; vf.inputMode = 'decimal';
    vf.style.cssText = 'background:none;border:none;color:#5db3ff;' +
      'padding:0;font:inherit;text-align:right';
    vf.value = fmtV(rel ? relSize() : +val);
    d.appendChild(rng); d.appendChild(vf);
    // ≈ metres: 'len' = cage units (× CAGE_UNIT × planeScale), 'm' = the
    // value already is metres (game-side wing spans)
    if (opts.dim === 'len' || opts.dim === 'm') {
      const mu = document.createElement('span');
      mu.style.cssText = 'flex:none;color:#4a525c;font-size:10px;' +
        'width:52px;overflow:hidden;text-align:right';
      d.appendChild(mu);
      meta.mu = mu;
    }
    rng.oninput = e => {
      vf.value = fmtV(+e.target.value);
      oninput(rel ? (sizeRef || 1) * +e.target.value : +e.target.value);
    };
    vf.onchange = () => {                // typed values clamp to the range
      if (rng.disabled) { vf.value = fmtV(rng.value); return; }
      let v = parseFloat(vf.value);
      if (!Number.isFinite(v)) { vf.value = fmtV(rng.value); return; }
      v = Math.max(lo, Math.min(hi, v));
      rng.value = v; vf.value = fmtV(v);
      oninput(rel ? (sizeRef || 1) * v : v);
    };
    widget = meta.el = rng; meta.vf = vf;
  }
  // double-click the label: reset to the loaded design's value (preset /
  // import / reset re-anchor the baseline — rec §6's per-row reset)
  if (meta.kind === 'slider' || meta.kind === 'step') {
    kSpan.title = label + ' — double-click: reset to the loaded design';
    kSpan.style.cursor = 'default';
    kSpan.ondblclick = () => {
      if (widget.disabled) return;
      const bv = BASELINE[k] != null ? BASELINE[k] : DEFAULTS[k];
      if (bv == null) return;
      oninput(rel ? bv : bv);
      syncSliders();
    };
  }
  if (opts.link) {                       // live "follows" checkbox
    const lc = document.createElement('input');
    lc.type = 'checkbox'; lc.id = 'l_' + k; lc.style.flex = 'none';
    lc.title = 'linked — follows ' + (opts.link.from || 'the front');
    d.insertBefore(lc, kSpan.nextSibling);
    meta.linkEl = lc;
    lc.onchange = () => {
      if (lc.checked) oninput(opts.link.sentinel);
      else oninput(P[opts.link.from] != null ? P[opts.link.from]
                                             : Math.max(lo, 0));
      syncSliders();
    };
  }
  if (opts.copyFrom) {                   // the one-shot "match front" gesture
    const b = document.createElement('button');
    b.textContent = '=';
    b.title = 'copy the front value now (' + opts.copyFrom +
      ') — the halves stay independent';
    b.style.flex = 'none';
    d.appendChild(b);
    b.onclick = () => {
      if (P[opts.copyFrom] == null) return;
      oninput(P[opts.copyFrom]);
      syncSliders();
    };
  }
  // STYLING AND SELECTION HOOKS (G77). The game's editor re-parents these
  // rows into its own two-column panel — one part at a time — so it needs to
  // find a row by its key and style it by its kind without knowing anything
  // about how the widget inside was built. Attributes only: no behaviour
  // hangs off either of them, and the bench pages ignore both.
  d.dataset.k = k;
  d.dataset.kind = meta.kind || '';
  d.classList.add('r-' + (meta.kind || 'x'));
};
// THE SIZE SLIDER READS ×1 FOR THE DESIGN YOU LOADED (user 2026-08-19:
// "the new plane scale should say 1"). `planeScale` stays the ONE stored
// size number — a config export carries it and nothing else — but the
// slider is shown RELATIVE to the size the current design was loaded at,
// so every preset opens at 1.000 and the slider means "bigger/smaller
// than this design". `sizeRef` re-anchors on every whole-set load
// (preset, saved config, JSON import, reset); dragging never moves it.
// Baking the factor into the length PARAMS instead was measured and
// rejected — see HANDOVER G19g.
let sizeRef = null;
const relSize = () => sizeRef ? (P.planeScale || 1) / sizeRef
                              : (P.planeScale || 1);
// BASELINE = the whole-set load the per-row double-click resets to; it
// re-anchors exactly where sizeRef does (preset, import, reset, boot)
let BASELINE = JSON.parse(JSON.stringify(DEFAULTS));
const anchorSize = () => {
  sizeRef = P.planeScale || 1;
  BASELINE = JSON.parse(JSON.stringify(P));
};

// LOADING A BUILD INTO THE EDITOR. This is the one operation that never
// existed (G63): `cageFromSpec` was reachable only from the paste-a-JSON
// prompt below, so a build loaded by the GAME rebuilt the game's aeroplane
// and left the editor showing the page template — and the next export
// overwrote the build with that template. Hoisted out of the bar's closure
// and published on window.CAGE_UI so the shelf, the game's own load path and
// the import all take the SAME route in.
//
// It starts from `cageFromSpec`, which starts from CAGE_PARAMS rather than
// from this page's defaults, so a build fully determines the aeroplane
// instead of inheriting the sliders it did not mention.
// A LOAD IS NOT A ROW CHANGE (2026-09-03). Two layers carry an "applies
// once" starter that fires when a value differs from the previous build's —
// the engine preset, and the cowl-for-architecture — and a load replaces P
// wholesale, so a file that named a different preset than the aeroplane you
// had open re-fired the starter and the preset overwrote the engine rows the
// file had saved. Every door that REPLACES P says so through `PAGE.load`
// before it builds; a layer's starter then records the loaded value instead
// of reacting to it. The design tiles (design_flow.js) deliberately do NOT go
// through here: a tile writing `engPreset` IS a row change and must fire.
const loaded = () => { if (PAGE.load) try { PAGE.load(); } catch (e) {} };

function applySpec(spec, what) {
  Object.assign(P, G.cageFromSpec(spec));
  loaded();
  // THE PAINT COMES WITH THE AEROPLANE (G105). Unconditional, INCLUDING when
  // the file has no `finish` at all: that is a build with no overrides, and
  // the aeroplane it describes is the factory one. Applying it only when
  // present is exactly how a load inherits the last aeroplane's colours.
  finishFromSpec(spec && spec.finish);
  // THE TANKS COME WITH THE AEROPLANE (G99). Same rule as the paint above,
  // and unconditional for the same reason: a file with no `energy` describes
  // the default tank, not "whatever the last aeroplane carried".
  if (window.CAGE_ENERGY && window.CAGE_ENERGY.fromSpec)
    try { window.CAGE_ENERGY.fromSpec(spec && spec.energy); }
    catch (e) { console.error('energy from spec:', e); }
  anchorSize();                            // the loaded design is now x1.000
  syncSliders(); build();
  if (what && $('stat')) $('stat').textContent = what;
}

const LSKEY = 'cageCfg:' + location.pathname;
// A PARSE FAILURE MUST NOT BE A WIPE. `savedCfgs` returning {} on a corrupt
// key was fine for reading and fatal for writing: the next save wrote that
// empty map back over every config in it. `cfgsOrNull` tells the two apart.
const cfgsOrNull = () => {
  try { const o = JSON.parse(localStorage.getItem(LSKEY) || '{}');
        return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; }
  catch (e) { return null; }
};
const savedCfgs = () => cfgsOrNull() || {};
// THE BENCH BAR. The GAME has a shelf instead (garage.js): one store, one
// format, stock designs and your own aeroplanes in one list. Two save bars
// over one design is how the project ended up with three stores and two
// incompatible files both tagged `flydiy-build`, so in the game this block
// does not exist at all. The standalone bench pages keep it.
if (!window.CAGE_IN_GAME) {
  // 'wrap' so the buttons fold to a second line instead of overflowing
  // the pane (user bug: json/imp were clipped invisible)
  const d = document.createElement('div'); d.className = 'r wrap';
  d.innerHTML = `<span class="k">preset</span><select id="presetSel"
    style="flex:1"></select>
    <button id="saveCfg" title="save current sliders as a named config">save</button>
    <button id="logCfg" title="log non-default params to console + clipboard">log</button>
    <button id="expCfg" title="download config as JSON (also copied)">json</button>
    <button id="impCfg" title="paste a config JSON">imp</button>`;
  ui.appendChild(d);
  d.querySelector('select').onchange = e => applyPreset(e.target.value);
  d.querySelector('#saveCfg').onclick = () => {
    const name = prompt('config name');
    if (!name) return;
    const all = cfgsOrNull();
    if (!all) return void alert('The saved configs are unreadable — saving now '
      + 'would overwrite them all. Clear ' + LSKEY + ' by hand first.');
    all[name] = { P: { ...P } };
    localStorage.setItem(LSKEY, JSON.stringify(all));
    fillPresetSel();
  };
  // JSON export/import: THE GAME'S OWN BUILD FILE (garage.js `envelope`), whose
  // spec carries the fuselage in `spec.cage` — so what the bench writes is not a
  // bench format the garage would have to learn, it is a build. `v` is read off
  // the core spec IF the page has loaded it and is null otherwise, which is the
  // guarded form garage.js itself uses rather than a second copy of the number.
  //
  // The cage fragment is DEVIATIONS from the template (cageToSpec), so a file
  // means the same thing on every page: importing resolves through
  // cageFromSpec, which starts from the template rather than from whatever this
  // page's PAGE.defaults happen to be, and a build therefore fully determines
  // the aeroplane instead of inheriting the sliders it did not mention.
  const buildFile = () => JSON.stringify({
    what: 'flydiy-build',
    v: (typeof GEN_SPEC_V === 'number' ? GEN_SPEC_V : null),
    name: 'cage', spec: { cage: G.cageToSpec(P), finish: finishToSpec() },
  }, null, 1);
  // Accepts a build envelope, a bare spec, the legacy {P:{...}} config, or a
  // bare parameter object — a spec pasted out of a console is a good thing to
  // want to load, and the old files stay loadable.
  const readFile = txt => {
    const o = JSON.parse(txt);
    if (o && o.spec && typeof o.spec === 'object') return o.spec;
    if (o && o.cage !== undefined) return o;
    if (o && o.P && typeof o.P === 'object') return { cage: o.P };
    return { cage: o };
  };
  d.querySelector('#expCfg').onclick = () => {
    const txt = buildFile();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt],
      { type: 'application/json' }));
    a.download = 'cage_build.json';
    a.click();
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    $('stat').textContent = 'build downloaded + copied to clipboard';
  };
  d.querySelector('#impCfg').onclick = () => {
    const txt = prompt('paste a flyDiy build or cage config JSON');
    if (!txt) return;
    try { applySpec(readFile(txt), 'build imported'); }
    catch (e) { $('stat').textContent = 'import failed: ' + e.message; }
  };
  d.querySelector('#logCfg').onclick = () => {
    const txt = JSON.stringify(G.cageToSpec(P), null, 1);
    console.log('spec.cage (deviations from the template):', txt);
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    $('stat').textContent = 'spec.cage logged to console + clipboard';
  };
}
function fillPresetSel() {
  const sel = $('presetSel');
  if (!sel) return;
  const builtin = Object.keys(PAGE.presets || {});
  const saved = Object.keys(savedCfgs());
  sel.innerHTML = builtin.map(k => `<option>${k}</option>`).join('') +
    saved.map(k => `<option>* ${k}</option>`).join('');
}
fillPresetSel();
// ---- view panel (viewer state, never spec — user ruling) ------------------
// explode, transparency, cutaway and camera presets are MAIN options: how
// you look at the build, not what the build is. explodeD technically still
// lives in P until the game swap moves it out of the spec.
{
  const det = document.createElement('details');
  det.open = true; det.dataset.g = 'view';
  const sum = document.createElement('summary');
  sum.textContent = 'view';
  det.appendChild(sum);
  ui.appendChild(det);
  mkRow(det, 'explodeD', 'explode', 0, 1, 0.005, P.explodeD,
        v => { P.explodeD = v; build(); });
  const mkA = (label, key0) => {
    const dd = document.createElement('div'); dd.className = 'r';
    dd.innerHTML = `<span class="k">${label}</span>
      <input type="range" min="0.05" max="1" step="0.05"
        value="${VIEW[key0]}">
      <span class="v">${VIEW[key0].toFixed(2)}</span>`;
    det.appendChild(dd);
    dd.querySelector('input').oninput = e => {
      VIEW[key0] = +e.target.value;
      dd.querySelector('.v').textContent = (+e.target.value).toFixed(2);
      build();
    };
  };
  mkA('glass α', 'glassA');
  mkA('fuselage α', 'bodyA');
  mkA('int skin α', 'skinA');
  mkA('structure α', 'structA');
  mkA('cowl α', 'cowlA');          // see the engine through the shell (G29)
  // SEE INSIDE — the five dials in one gesture, plus the click-through the
  // dials never had. It is a CHECKBOX and not a sixth slider on purpose: the
  // dials are for looking, this is for working on what is underneath.
  {
    const dx = document.createElement('div'); dx.className = 'r';
    dx.title = 'Fade the covering and click straight through it — ' +
               'the engine, the seats and the panel become reachable';
    dx.innerHTML = `<span class="k">see inside</span>
      <label style="flex:none"><input type="checkbox" id="xray"></label>`;
    det.appendChild(dx);
    dx.querySelector('input').onchange = e => {
      VIEW.xray = e.target.checked ? 1 : 0;
      build();
    };
  }
  const d = document.createElement('div'); d.className = 'r';
  d.innerHTML = `<span class="k">cutaway</span>
    <label style="flex:none"><input type="checkbox" id="cutaway"></label>`;
  det.appendChild(d);
  d.querySelector('#cutaway').onchange = e => {
    renderer.clippingPlanes = e.target.checked
      ? [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)] : [];
    draw();
  };
  const dl = document.createElement('div'); dl.className = 'r';
  dl.innerHTML = `<span class="k">canopy loops</span>
    <label style="flex:none"><input type="checkbox" id="canLoopsV"
      checked></label>`;
  det.appendChild(dl);
  dl.querySelector('#canLoopsV').onchange = e => {
    VIEW.loops = e.target.checked ? 1 : 0; build();
  };
  // THE GAME'S ROOM LIGHTS THE BUILD (G36). The G35.2-4 arc tried to
  // reproduce the stand view's pipeline inside the bench renderer —
  // physical lights, understudies, PMREM, sRGB — and each pass only
  // half-converged (user: "still huge differences ... why wouldn't you
  // just use the previous environment as it is and put the mesh in
  // it?"). That is what happens now: in the game (EXT) the build lives
  // in the game's own garage scene and takes its renderer, room, moods
  // and #bEnv/#bMood buttons wholesale; the bench keeps its flat rig.
  //
  // ONE RECIPE FOR EVERY PART (G38, user: "get back to a super simple
  // material for all, just a color, and same settings for everything
  // else"). The G36 pass understudied only the Lambert families, which
  // left each layer's OWN roughness/metalness in play — the wing sat at
  // 0.55/0.05 while the understudied body sat at 0.85/0.00, and the
  // glossier surfaces drank more of the room's environment and read
  // washed (the user's eye was right). Now EVERY lit mesh material in
  // the build is understudied by the same matte Standard — colour,
  // sides and alpha are the part's own; roughness 0.85, metalness 0,
  // no maps, no emissive, for everything. Colour/alpha SYNC each pass,
  // because some layers mutate their material instances in place (the
  // wing's fuselage-alpha fade). Unlit markers and wire lines pass
  // through. Re-applied after every build; the gearSit grid keeps
  // yielding to the room's real floor.
  if (EXT) {
    const uniFor = new Map();
    const LIT = new Set(['MeshLambertMaterial', 'MeshPhongMaterial',
                         'MeshStandardMaterial', 'MeshPhysicalMaterial']);
    const uniOf = m => {
      let u = uniFor.get(m);
      if (!u) {
        u = new THREE.MeshStandardMaterial({
          roughness: 0.85, metalness: 0.0,
          vertexColors: m.vertexColors });
        u.userData.cageUni = 1;        // never understudy an understudy
        uniFor.set(m, u);
      }
      u.color.copy(m.color);
      u.side = m.side;
      u.transparent = m.transparent;
      u.opacity = m.opacity;
      u.depthWrite = m.depthWrite;
      return u;
    };
    const extPass = () => {
      scene.traverse(o => {
        if (o instanceof THREE.GridHelper) o.visible = false;
        if (!o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        let touched = false;
        // AEROSKIN IS NOT UNDERSTUDIED (G67). This pass exists to give
        // every part one matte recipe while the loop was validated ugly, and
        // an AEROSKIN material is a MeshStandardMaterial, so without this it
        // would be replaced by flat grey the moment the editor opened in the
        // game — the whole chantier invisible, in the one place it matters.
        // It is skipped BY DESIGN, not as an exception: the uniform recipe
        // was declared at G38 as the baseline "until materials become a real
        // chantier (P9)", and this is that chantier.
        // A SKINNED MESH KEEPS ITS OWN MATERIAL (G204): the understudy has
        // no skinning and no map, so a rigged character under it would
        // collapse to its bind pose in flat grey — and the mesh IS the skin.
        const nm = mats.map(m => (LIT.has(m.type) && !m.userData.cageUni
          && !m.userData.aeroskin && !o.isSkinnedMesh)
          ? (touched = true, uniOf(m)) : m);
        if (touched)
          o.material = Array.isArray(o.material) ? nm : nm[0];
        // CONTACT SHADOW (G41, G42): the build CASTS onto the room —
        // now onto the centre lamps' spot maps, which actually cover
        // the stand — but does NOT self-receive: receiving put shadow
        // acne stripes on the thin double-sided fabric (the user's
        // "artifacts on the side of the aircraft"). Translucent parts
        // (canopy glass) cast nothing: an opaque pane shadow reads
        // wrong.
        if (o.isMesh) {
          const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
          o.castShadow = !(m0 && m0.transparent);
          o.receiveShadow = false;
        }
      });
    };
    const prevPost = PAGE.post;
    PAGE.post = ctx => { if (prevPost) prevPost(ctx); extPass(); };
    extPass();

    // THE HANGAR SECTION (G40, rebuilt G41): lighting, then ONE
    // sub-group per hangar part — material from the library, tile size,
    // roughness and normal-influence multipliers — all through the
    // game's GARAGE_ENV handle. Boot happens on first garage entry, so
    // the room exists and the lists are live. Tile default = each set's
    // stated coverage (2 m; the floor slab 5 m); the sliders are the
    // manual override the user asked for.
    if (window.GARAGE_ENV) {
      const GE = window.GARAGE_ENV;
      const hd = document.createElement('details');
      hd.open = true; hd.dataset.g = 'hangar';
      const hs = document.createElement('summary');
      hs.textContent = 'hangar';
      hd.appendChild(hs);
      det.after(hd);
      const row = (host, html) => { const d = document.createElement('div');
        d.className = 'r'; d.innerHTML = html; host.appendChild(d); return d; };
      // DOUBLE-CLICK THE LABEL TO RESET. mkRow gives every parameter row this
      // for free off the DEFAULTS table; the rows in this section are not
      // parameter rows — they drive the ROOM, which has no P and no baseline —
      // so they reach the owning module for the resting value instead. `get`
      // returning null means the module is too old to publish one, and the
      // affordance simply is not offered rather than resetting to a guess.
      const resetOnLabel = (d, get, apply) => {
        const kSpan = d.querySelector('.k');
        if (!kSpan || typeof get !== 'function') return;
        if (get() == null) return;
        kSpan.title = kSpan.textContent + ' — double-click: reset';
        kSpan.style.cursor = 'default';
        kSpan.ondblclick = () => {
          const b = get();
          if (b == null) return;
          apply(b);
        };
      };
      // A MOOD IS A SKY NOW (G62), so the row says what it actually picks:
      // the HDRI standing outside the door, and the light rig measured off it.
      const mr = row(hd, `<span class="k">time of day</span><select></select>`);
      const msel = mr.querySelector('select');
      (GE.moods() || []).forEach((n, i) => {
        const o = document.createElement('option');
        o.value = i; o.textContent = String(n).toLowerCase();
        msel.appendChild(o);
      });
      msel.selectedIndex = GE.mood() || 0;
      msel.onchange = () => GE.setMood(msel.selectedIndex);
      // THE SHELL (HANGARS S2/S3): what the building IS, before how big it
      // is. Shells still on the drawing board are offered greyed rather than
      // hidden — a menu that shrinks is a menu you cannot trust.
      if (GE.shells && GE.shells().length && GE.setShell) {
        const sr = row(hd, `<span class="k">shell</span><select></select>`);
        const ssel = sr.querySelector('select');
        for (const s of GE.shells()) {
          const o = document.createElement('option');
          o.value = s.key;
          o.textContent = s.name.toLowerCase() +
            (s.status !== 'live' ? ' — soon' : '');
          o.disabled = s.status !== 'live';
          ssel.appendChild(o);
        }
        ssel.value = GE.shell();
        ssel.onchange = () => {
          const got = GE.setShell(ssel.value);
          if (!got) ssel.value = GE.shell();
          refreshDims(); paintFit(); paintCaps();
        };
      }
      // THE SHED'S SIZE (G53). Three numbers rebuild the whole room, so the
      // sliders commit on RELEASE, not on every pixel of a drag — a rebuild
      // is a thousand lines of geometry and a fresh environment bake. The
      // envelope is the SHELL's now, so a shell change re-reads it.
      const dimRefreshers = [];
      function refreshDims() { dimRefreshers.forEach(f => f()); }
      if (GE.setDims && GE.dims()) {
        const dimRow = (key, label, mul, unit) => {
          const d = row(hd, `<span class="k">${label}</span>
            <input type="range" step="${mul > 1 ? 0.5 : 0.1}"><span class="v"></span>`);
          const inp = d.querySelector('input'), v = d.querySelector('.v');
          const show = n => { v.textContent = (+n).toFixed(1) + ' ' + unit; };
          const sync = () => {
            const L = GE.dimLimits(), d0 = GE.dims();
            if (!L || !d0) return;
            inp.min = L[key][0] * mul; inp.max = L[key][1] * mul;
            inp.value = d0[key] * mul; show(inp.value);
          };
          sync();
          dimRefreshers.push(sync);
          inp.oninput = () => show(inp.value);
          inp.onchange = () => {
            const got = GE.setDims({ [key]: +inp.value / mul });
            if (got) show(got[key] * mul);
          };
        };
        dimRow('HW', 'width', 2, 'm');       // the sliders speak in FULL sizes
        dimRow('HD', 'depth', 2, 'm');
        dimRow('EAVE', 'eaves', 1, 'm');
      }
      // THE FIT-OUT (HANGARS S2): a toggle per kit, in the lights strip's own
      // shape. Below it, the two lines the whole mechanism exists for: what
      // would NOT fit this shell — never silently — and the verbs the shed
      // has earned (derived from the kits, advisory, never enforced).
      let paintFit = () => {}, paintCaps = () => {};
      if (GE.kits && GE.kits().length && GE.setKit) {
        const kr = row(hd, `<span class="k">fit-out</span><span class="lt"></span>`);
        const khost = kr.querySelector('.lt');
        for (const k0 of GE.kits()) {
          const b = document.createElement('button');
          b.className = 'tg';
          b.textContent = k0.name.toLowerCase();
          const on = () => {
            const k = (GE.kits() || []).find(x => x.key === k0.key);
            return !!(k && k.on);
          };
          const paint = () => b.classList.toggle('off', !on());
          b.onclick = () => { GE.setKit(k0.key, !on()); paint();
                              paintFit(); paintCaps(); };
          paint();
          khost.appendChild(b);
        }
        const fr = row(hd, `<span class="k">won’t fit</span><span class="v"></span>`);
        const cr = row(hd, `<span class="k">can do</span><span class="v"></span>`);
        paintFit = () => {
          const r = GE.fitReport ? GE.fitReport() : null;
          const u = (r && r.unplaced) || [];
          fr.style.display = u.length ? '' : 'none';
          fr.querySelector('.v').textContent =
            u.map(x => x.key + ' (' + x.reason + ')').join(', ');
        };
        paintCaps = () => {
          // the advisory line (HANGARS S5): what the shed can do, and what
          // the build on the floor WANTS of it — flagged, never enforced
          const caps = (GE.caps && GE.caps()) || [];
          const wants = (GE.wants && GE.wants()) || [];
          let txt = caps.join(' · ');
          if (wants.length)
            txt += '  |  this build wants ' + wants.map(w =>
              caps.includes(w) ? w : w + ' (not on hand)').join(' · ');
          cr.querySelector('.v').textContent = txt;
        };
        paintFit(); paintCaps();
      }
      // THE LIGHT SWITCHES (G62.3, user: "I'll need turning off the hangar
      // lights from the garage, so I can run tests and see what light source
      // interacts correctly and not"). One toggle per source, plus the one
      // that is not a light: whether the AEROPLANE is in the room's own
      // reflection probe, which is where a saturated paint job leaks into
      // every surface in the shed.
      if (GE.lights && GE.lights().length) {
        const lr = row(hd, `<span class="k">lights</span><span class="lt"></span>`);
        const host = lr.querySelector('.lt');
        const mk = (key, label, get, set) => {
          const b = document.createElement('button');
          b.className = 'tg';
          b.textContent = label;
          const paint = () => b.classList.toggle('off', !get());
          b.__paint = paint;            // the ALL/NONE masters repaint the row
          b.onclick = () => { set(!get()); paint(); };
          paint();
          host.appendChild(b);
          return b;
        };
        // ALL / NONE FIRST (user: "we need to be able to add lights one by
        // one from nothingness (all look black)"). The point of the strip is
        // not to toggle a source, it is to ANSWER A QUESTION — which of these
        // is doing that? — and the only reliable way to ask it is to go to
        // black and add one back. Doing that seven clicks at a time is how a
        // source gets left on and a wrong answer gets believed.
        const master = (label, pick) => {
          const b = document.createElement('button');
          b.className = 'tg alt';
          b.textContent = label;
          b.onclick = () => { GE.setLights(pick); repaint(); };
          host.appendChild(b);
        };
        const paints = [];
        master('none', () => false);
        master('all', () => true);
        for (const L of GE.lights())
          paints.push(mk(L.key, L.key, () => GE.lightOn(L.key),
                         v => GE.setLight(L.key, v)));
        if (GE.setCraftInProbe)
          mk('probe', 'craft→probe', () => GE.craftInProbe(),
             v => GE.setCraftInProbe(v));
        function repaint() { paints.forEach(b => b.__paint && b.__paint()); }
      }
      // THE WORLD'S LIGHTS, in the same shape (this chantier). The world has
      // never had a panel, which is most of why its two independent uplights —
      // the hemisphere's ground half and the environment's ground cap — sat
      // there stacked on each other for so long: with no way to isolate
      // either, there was no way to notice there were two.
      if (GE.worldLights && GE.worldLights().length) {
        const wr = row(hd, `<span class="k">world lights</span><span class="lt"></span>`);
        const whost = wr.querySelector('.lt');
        const wPaints = [];
        const wmk = (key, label) => {
          const b = document.createElement('button');
          b.className = 'tg';
          b.textContent = label;
          b.__paint = () => b.classList.toggle('off', !GE.worldLightOn(key));
          b.onclick = () => { GE.setWorldLight(key, !GE.worldLightOn(key)); b.__paint(); };
          b.__paint(); whost.appendChild(b); wPaints.push(b); return b;
        };
        const wmaster = (label, pick) => {
          const b = document.createElement('button');
          b.className = 'tg alt'; b.textContent = label;
          b.onclick = () => { GE.setWorldLights(pick); wPaints.forEach(x => x.__paint()); };
          whost.appendChild(b);
        };
        wmaster('none', () => false);
        wmaster('all', () => true);
        for (const L of GE.worldLights()) wmk(L.key, L.key);
      }
      // THE GROUND BOUNCE. How much of the lit floor an aeroplane standing on
      // it can actually see — the term the reflection probe never had, and the
      // reason the belly of the wing used to glow. It is a judgement, not a
      // measurement, so it is a knob: 0 is a floor that returns nothing, 1 is
      // the unoccluded half-dome of concrete this room used to hand back.
      if (GE.groundBounce && GE.setGroundBounce) {
        const d = row(hd, `<span class="k">ground bounce</span>
          <input type="range" min="0" max="1" step="0.01">
          <span class="v"></span>`);
        const inp = d.querySelector('input'), v = d.querySelector('.v');
        const show = n => { v.textContent = (+n).toFixed(2); };
        inp.value = GE.groundBounce(); show(inp.value);
        inp.oninput = () => show(inp.value);          // the re-bake is not free
        inp.onchange = () => show(GE.setGroundBounce(+inp.value));
        // DOUBLE-CLICK THE LABEL TO RESET, the same affordance every _cage_ui
        // row has (mkRow, above). These hangar rows are hand-built and have no
        // DEFAULTS table behind them, so the resting value is read from the
        // module that owns it (user, 2026-08-31: "neutralize the controls").
        resetOnLabel(d, GE.groundBounceDefault, b => {
          inp.value = b; show(GE.setGroundBounce(b));
        });
      }
      // THE LAMP RIG (G64, user: "for the lamps, give me an intensity and
      // spread control please, as well as a light temperature control"). Here
      // rather than in a panel of its own, because the panel of its own was
      // the thing he asked to have removed. None of the three rebuilds
      // anything, so unlike the size sliders they commit live on drag.
      if (GE.lampRig && GE.lampRig()) {
        const R0 = GE.lampRig();
        const knob = (key, label, min, max, step, fmt, toUi, fromUi) => {
          const d = row(hd, `<span class="k">${label}</span>
            <input type="range" min="${min}" max="${max}" step="${step}">
            <span class="v"></span>`);
          const inp = d.querySelector('input'), v = d.querySelector('.v');
          const show = n => { v.textContent = fmt(+n); };
          inp.value = toUi(R0[key]); show(inp.value);
          inp.oninput = () => {
            show(inp.value);
            GE.setLampRig({ [key]: fromUi(+inp.value) });
          };
          // same reset affordance as every other row — see the note on the
          // ground-bounce row above
          resetOnLabel(d, () => {
            const D = GE.lampRigDefault && GE.lampRigDefault();
            return D ? D[key] : null;
          }, raw => {
            inp.value = toUi(raw); show(inp.value);
            GE.setLampRig({ [key]: raw });
          });
        };
        const I = v => v;
        knob('gain', 'lamp power', 0, 3, 0.05, n => '×' + n.toFixed(2), I, I);
        // the slider speaks in FULL cone degrees; three.js wants the half-angle
        knob('angle', 'lamp spread', 20, 140, 1, n => n.toFixed(0) + '°',
             r => Math.round(2 * r * 180 / Math.PI), d => d * Math.PI / 360);
        knob('kelvin', 'lamp colour', 1800, 6500, 50,
             n => n.toFixed(0) + ' K', I, I);
      }
      // HOW THE SKY IS MADE (G62.3): the GPU grade against the precomputed
      // pictures, switchable live. Only shows when the payload carries both.
      if (GE.skyModes && GE.skyModes().length > 1) {
        const sr = row(hd, `<span class="k">sky source</span><select></select>`);
        const ssel = sr.querySelector('select');
        for (const [k, n] of GE.skyModes()) {
          const o = document.createElement('option');
          o.value = k; o.textContent = n;
          ssel.appendChild(o);
        }
        ssel.value = GE.skyMode();
        ssel.onchange = () => GE.setSkyMode(ssel.value);
      }
      // REFLECTIONS (G52): where scene.environment is baked FROM. The room's
      // own cube pass is the default; the sky option PMREMs the HDRI that now
      // actually shows through the cut windows — whichever of the five the
      // time of day above has hung there. Absent when there is no sky.
      const srcs = GE.envSources ? GE.envSources() : [];
      if (srcs.length) {
        const er = row(hd, `<span class="k">reflections</span><select></select>`);
        const esel = er.querySelector('select');
        for (const [k, n] of srcs) {
          const o = document.createElement('option');
          o.value = k; o.textContent = n;
          esel.appendChild(o);
        }
        esel.value = GE.envSource();
        esel.onchange = () => GE.setEnvSource(esel.value);
      }
      // THE BAKED FLOOR SHADOW: the furniture's print on the slab.
      if (GE.groundShadow && GE.groundShadow() !== null) {
        const gr = row(hd, `<span class="k">floor shadow</span>
          <input type="range" min="0" max="1" step="0.05"><span class="v"></span>`);
        const gi = gr.querySelector('input'), gv = gr.querySelector('.v');
        gi.value = GE.groundShadow(); gv.textContent = (+gi.value).toFixed(2);
        gi.oninput = () => { const r = GE.groundShadow(+gi.value);
          gv.textContent = (+r).toFixed(2); };
      }
      // THE MOBILE KIT is the room's only clutter standing in the open floor,
      // and it follows the aeroplane — which is exactly what is in the way
      // when the question is about the shape.
      if (GE.setMobile) {
        const kr = row(hd, `<span class="k">mobile kit</span>
          <label style="flex:none"><input type="checkbox"></label>`);
        const kc = kr.querySelector('input');
        kc.checked = GE.mobileShown();
        kc.onchange = () => GE.setMobile(kc.checked);
      }
      const lib = GE.library();
      for (const part of GE.parts()) {
        const pd = document.createElement('details');
        const ps = document.createElement('summary');
        ps.textContent = part.name;
        pd.appendChild(ps);
        hd.appendChild(pd);
        const st = GE.part(part.key) || { set: 'baked', tile: 2, rough: 1, nrm: 1 };
        const sr = row(pd, `<span class="k">material</span><select></select>`);
        const sel2 = sr.querySelector('select');
        for (const L of lib) {
          const o = document.createElement('option');
          o.value = L.key; o.textContent = L.name;
          sel2.appendChild(o);
        }
        sel2.value = st.set;
        const mkSlide = (label, min, max, step, val, unit) => {
          const d = row(pd, `<span class="k">${label}</span>
            <input type="range" min="${min}" max="${max}" step="${step}">
            <span class="v"></span>`);
          const inp = d.querySelector('input'), v = d.querySelector('.v');
          inp.value = val;
          v.textContent = (+val).toFixed(unit === 'm' ? 1 : 2) +
            (unit === 'm' ? ' m' : '');
          return { inp, v, unit };
        };
        const tile = mkSlide('tile size', 0.5, 8, 0.1, st.tile, 'm');
        const rough = mkSlide('roughness ×', 0, 2, 0.05, st.rough, '');
        const nrm = mkSlide('normal ×', 0, 2, 0.05, st.nrm, '');
        const apply = () => {
          GE.setPart(part.key, { set: sel2.value, tile: +tile.inp.value,
            rough: +rough.inp.value, nrm: +nrm.inp.value });
          tile.v.textContent = (+tile.inp.value).toFixed(1) + ' m';
          rough.v.textContent = (+rough.inp.value).toFixed(2);
          nrm.v.textContent = (+nrm.inp.value).toFixed(2);
        };
        sel2.onchange = apply;
        tile.inp.oninput = apply;
        rough.inp.oninput = apply;
        nrm.inp.oninput = apply;
      }
    }
  }
  // the measuring box round the aeroplane (the pane below the view is
  // always on — the box is the display option)
  const db = document.createElement('div'); db.className = 'r';
  db.innerHTML = `<span class="k">dims box</span>
    <label style="flex:none"><input type="checkbox" id="dimsBox"></label>`;
  det.appendChild(db);
  db.querySelector('#dimsBox').onchange = build;
  dimsEl = document.createElement('div');
  dimsEl.id = 'dims';
  dimsEl.style.cssText = 'position:absolute;left:10px;bottom:10px;z-index:2;' +
    'background:rgba(18,21,26,.84);border:1px solid #242a33;border-radius:5px;' +
    'padding:7px 10px;color:#dfe6ee;pointer-events:none;' +
    'font:11px/1.55 ui-monospace,Menlo,Consolas,monospace';
  // EXT has no #view; the dims pane docks at the panel's foot instead
  ($('view') || ui).appendChild(dimsEl);
  // EXT: the game camera is the camera — the bench presets have nothing
  // to move, so the row stays off the panel
  const vb = document.createElement('div'); vb.className = 'r';
  vb.innerHTML = `<span class="k">camera</span>
    <button data-v="q">3/4</button><button data-v="s">side</button>
    <button data-v="f">front</button><button data-v="t">top</button>
    <button data-v="i">inside</button><button data-v="r">refit</button>`;
  if (!EXT) det.appendChild(vb);
  vb.querySelectorAll('button').forEach(b => b.onclick = () => {
    const v = b.dataset.v;
    if (v === 'i') {
      // eye roughly at the pilot seat, looking forward at the panel area
      yaw = Math.PI; pitch = 0.02;
      centreOv = new THREE.Vector3(0, 0.15, 3.0);
      ZOOM = fitR / 1.1;
    } else if (v === 'r') { centreOv = null; ZOOM = 1; }
    else {
      centreOv = null;
      if (v === 'q') { yaw = -0.85; pitch = 0.30; }
      if (v === 's') { yaw = Math.PI / 2; pitch = 0; }
      if (v === 'f') { yaw = 0; pitch = 0.02; }
      if (v === 't') { yaw = -0.85; pitch = 1.30; }
    }
    draw();
  });
}

// ---- parameter groups (one nesting level supported) -----------------------
// after [k,label,lo,hi,st] a row may carry a names ARRAY and/or an opts
// OBJECT, in either order; a (sub)group may carry 'open' and/or an opts
// object after its item list
const rowTail = it => {
  let names, opts;
  for (const x of it.slice(5)) {
    if (Array.isArray(x)) names = x;
    else if (x && typeof x === 'object') opts = x;
  }
  return { names, opts };
};
const groupTail = (el, def, from) => {
  let gopts = {};
  for (const x of def.slice(from)) {
    if (x === 'open') el.open = true;
    else if (x && typeof x === 'object') gopts = x;
  }
  GROUPMETA.push({ el, opts: gopts });
  return gopts;
};
const renderItems = (parent, items, path) => {
  for (const it of items) {
    if (Array.isArray(it[1])) {
      const sub = document.createElement('details');
      sub.dataset.g = path + '/' + it[0];
      const ss = document.createElement('summary');
      ss.textContent = it[0];
      sub.appendChild(ss);
      groupTail(sub, it, 2);
      parent.appendChild(sub);
      renderItems(sub, it[1], path + '/' + it[0]);
      continue;
    }
    const [k, label, lo, hi, st] = it;
    const { names, opts } = rowTail(it);
    // aft-pod rows get the one-shot "= front" button automatically — the
    // key table already exists in the generator (CAGE_AFT_SUB)
    let o2 = opts;
    if (G.CAGE_AFT_SUB && (!opts || !opts.copyFrom))
      for (const [ak, fk] of G.CAGE_AFT_SUB)
        if (ak === k) o2 = Object.assign({}, opts, { copyFrom: fk });
    mkRow(parent, k, label, lo, hi, st, P[k], v => { P[k] = v; build(); },
          names, o2);
  }
};
for (const gdef of GROUPS) {
  const gname = gdef[0], items = gdef[1];
  const det = document.createElement('details');
  det.dataset.g = gname;
  const sum = document.createElement('summary');
  sum.textContent = gname;
  det.appendChild(sum);
  if (gname === 'interior') det.open = true;
  groupTail(det, gdef, 2);
  ui.appendChild(det);
  renderItems(det, items, gname);
}
// ---- existence + expert pass (rec §2) -------------------------------------
// `when` rows/groups re-evaluate after every build, so a discriminator
// reveals its dependents live; expert-tagged content sits behind one
// global switch (persisted) instead of a "don't touch" folder.
function applyRowVis() {
  const FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
  for (const g of GROUPMETA) {
    let vis = !(g.opts.level === 'expert' && !EXPERT.on);
    if (vis && g.opts.when) { try { vis = !!g.opts.when(P); } catch (e) {} }
    g.el.style.display = vis ? '' : 'none';
  }
  for (const meta of ROWMETA) {
    const o = meta.opts;
    if (o && (o.when || o.level)) {
      let vis = !(o.level === 'expert' && !EXPERT.on);
      if (vis && o.when) { try { vis = !!o.when(P); } catch (e) {} }
      meta.row.style.display = vis ? '' : 'none';
    }
    // optHide (2026-09-05): a select whose OPTIONS follow a discriminator —
    // P => [hidden per option]. The value stays the index into the full
    // list, so a saved number never changes meaning; the engine row folds
    // the other layouts' catalogue away.
    if (meta.kind === 'select' && o && o.optHide && meta.el) {
      let hide = null;
      try { hide = o.optHide(P); } catch (e) {}
      if (hide)
        Array.from(meta.el.options).forEach(op => {
          // by VALUE, not position: optOrder may have reordered the options
          const i = +op.value;
          op.hidden = !!hide[i]; op.disabled = !!hide[i];
        });
    }
    if (meta.mu)
      meta.mu.textContent = P[meta.k] == null ? '' :
        '≈ ' + (P[meta.k] * (meta.opts.dim === 'm' ? 1 : FS)).toFixed(2) +
        ' m';
  }
  // ...AND THEN THE PANEL THAT OWNS THE ROWS (G77). In the game the rows do
  // not live in the accordion above: the editor moves them into its own
  // part inspector, so the GROUP-level `when`/`level` rules just applied to
  // the <details> elements no longer reach them. This is where it takes over.
  // The order matters — it runs LAST, over rows this pass has just decided
  // about, and it is the only hook that can override that decision.
  if (typeof window !== 'undefined' && window.CAGE_ON_VIS)
    try { window.CAGE_ON_VIS(); } catch (e) {}
}
{
  // In the game the switch is a pill at the foot of the properties column
  // (the design's `expert rows`, beside `reset part`) and the editor owns it.
  const hasExpert = !window.CAGE_IN_GAME &&
    (GROUPMETA.some(g => g.opts.level === 'expert') ||
     ROWMETA.some(m => m.opts && m.opts.level === 'expert'));
  if (hasExpert) {
    const d = document.createElement('div'); d.className = 'r';
    d.innerHTML = `<span class="k">expert rows</span>
      <label style="flex:none"><input type="checkbox" id="expertOn"
        ${EXPERT.on ? 'checked' : ''}></label>`;
    const anchor = ui.querySelector('.r.wrap');
    if (anchor) anchor.after(d); else ui.prepend(d);
    d.querySelector('#expertOn').onchange = e => {
      EXPERT.on = e.target.checked;
      try { localStorage.setItem('cageExpert', EXPERT.on ? '1' : '0'); }
      catch (err) {}
      applyRowVis();
    };
  }
}
// ---- G28: one home for the chrome -----------------------------------------
// The header's controls duplicate the panel's territory (user: "all in
// panel or all in top bar"). They MOVE into the panel — the elements
// themselves relocate, so ids and handlers survive — the header keeps
// the title. subsurf (and a page's template-step select) join the
// POLYCOUNT group when the page has one, the display toggles join
// `view`, export/reset join the file row, which also gains COLLAPSE.
{
  const viewDet = document.querySelector('details[data-g="view"]');
  const polyDet = document.querySelector('details[data-g="polycount"]');
  const fileRow = ui.querySelector('.r.wrap');
  const adopt = (id, label, host, first) => {
    const el = $(id);
    if (!el || !host) return;
    const lab = el.closest('label');
    const d = document.createElement('div'); d.className = 'r';
    const k = document.createElement('span');
    k.className = 'k'; k.textContent = label; k.title = label;
    d.appendChild(k); d.appendChild(el);
    el.style.flex = el.tagName === 'SELECT' ? '1' : 'none';
    const sum = host.querySelector('summary');
    if (first && sum) sum.after(d); else host.appendChild(d);
    if (lab) lab.remove();
  };
  // the surface-field view (G66) makes its OWN control: every bench page
  // would otherwise need the same three lines of HTML, and this one is a
  // diagnostic that has to be available wherever a cage is built.
  // AEROSKIN's own switch (G67), built here for the same reason: every bench
  // page would otherwise need the same lines, and the material mode has to be
  // reachable wherever a cage is built.
  if (!$('mat') && viewDet) {
    const s3 = document.createElement('select');
    s3.id = 'mat';
    // THE MATERIAL IS THE DEFAULT NOW (G67.1), and the section palette is the
    // diagnostic it always said it was. It was the other way round at G67
    // because AEROSKIN was new and the palette was how you told the sections
    // apart; but the game now OPENS on the cage build, and opening it in a
    // harlequin of magenta and green would say the aeroplane looks like that.
    // The order of these two rows IS the default — the first option is what a
    // select shows — so it is stated here rather than set somewhere else.
    for (const [v, t] of [['material', 'AEROSKIN'],
                          ['sections', 'section colours']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; s3.appendChild(o);
    }
    // ...and the choice STICKS, which the diagnostic view needs more than the
    // default does: switching to section colours to find a band and coming
    // back to a rebuilt panel that had silently reverted was the annoyance.
    try {
      const sv = localStorage.getItem('flydiy.cageMatView');
      if (sv === 'sections' || sv === 'material') s3.value = sv;
    } catch (e) {}
    s3.addEventListener('change', () => {
      try { localStorage.setItem('flydiy.cageMatView', s3.value); } catch (e) {}
    });
    s3.title = 'flat section colours (the diagnostic palette) or the real ' +
      'finish for each section under the current construction, tinted by ' +
      'the section colour';
    viewDet.appendChild(s3);
  }
  adopt('mat', 'materials', viewDet, true);
  if (!$('surf') && viewDet) {
    const s2 = document.createElement('select');
    s2.id = 'surf';
    for (const [v, t] of [['off', 'off'], ['tile', 'metric checker'],
                          ['grid', 'stations & rails']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; s2.appendChild(o);
    }
    s2.title = 'the surface field: a ' + SURF_TILE +
      ' m checker off (sL, sC) — squares stay square where the field is ' +
      'metric — or the station/rail lattice, with GUARD loops in red';
    viewDet.appendChild(s2);
  }
  adopt('surf', 'surface field', viewDet, true);
  adopt('step', 'template step', polyDet || viewDet, true);
  // SUBSURF IS A BENCH INSTRUMENT (G106.1, the user: "force subsurf too,
  // level 2. It shouldn't even be an option in this editor anymore. OK to keep
  // it in the cage, but not in game"). The subdivision level is how smooth the
  // aeroplane IS, not how you are looking at it — the builder does not choose
  // it any more than they choose how many rings a fuselage has. On the bench
  // it is exactly the right control: that is where the template's behaviour at
  // each level is the thing under study.
  //
  // The ELEMENT stays where it was built (#edBar, hidden) rather than being
  // removed, because `build()` reads `+$('lvl').value` on every build and its
  // markup carries `<option selected>2</option>`. A missing element there is a
  // NaN level, which is a different and much louder kind of wrong.
  if (!window.CAGE_IN_GAME)
    adopt('lvl', 'subsurf', polyDet || viewDet, true);
  // last-called lands first under the summary: view reads cage,
  // wireframe, colours, curvature, then the alpha rows
  adopt('curv', 'curvature heat', viewDet, true);
  adopt('color', 'section colours', viewDet, true);
  adopt('wire', 'wireframe', viewDet, true);
  adopt('cage', 'control cage', viewDet, true);
  if (fileRow) {
    for (const [id, txt] of [['objBtn', 'obj'], ['resetBtn', 'reset']]) {
      const b = $(id);
      if (b) { b.textContent = txt; fileRow.appendChild(b); }
    }
    const col = document.createElement('button');
    col.textContent = 'collapse';
    col.title = 'close every group';
    fileRow.appendChild(col);
    col.onclick = () =>
      ui.querySelectorAll('details').forEach(d2 => { d2.open = false; });
  }
}
// THE SECTION LEGEND is a bench diagnostic — a key to the flat colour palette
// the `sections` display mode paints. In the game the part tree IS the legend
// (and G79 will tint the selected part in the view), so it does not appear
// there; it stays the anchor the materials panel inserts itself before.
const lg = document.createElement('div');
if (!window.CAGE_IN_GAME)
  lg.innerHTML = '<h2>sections</h2>' + Object.keys(SEC).map(k =>
    `<div class="leg"><span class="sw" style="background:${SEC[k]}"></span>${k}</div>`
  ).join('');
ui.appendChild(lg);

// ---- THE MATERIALS PANEL (G67) --------------------------------------------
// The user's ask, from the start: "at some point I will want to tweak
// individual materials, so maybe it's better to make me a little editor like
// the hangar". So this is the hangar section's own shape (G41): one row per
// dressable thing, the choice on the left, the override on the right, and
// the whole state persisted as ONE JSON pref that restores with the build.
//
// THE LIST IS READ OFF THE BUILD, never hard-coded — the same discipline
// _props.html states for the prop bench ("nothing on this page knows any
// asset's name"). A section that exists in the mesh and not in this panel
// would be a bake failure, not a panel that needs editing; and the sections
// that exist depend on what you built (a rod boom has no taper, a pod has no
// tail cap), so a fixed list would go stale the first time a discriminator
// moved.
// ---- DECALS (G69) ---------------------------------------------------------
// The registration first, because it is the one every aeroplane must carry
// and because G4.5 named it the seed of exactly this. It is placed in the
// SURFACE FIELD — metres along the body, metres around the section — so it
// holds its proportions on any shape, lands on both flanks by construction,
// and needs no projection matrix at all (see aeroskin.js).
// TWO CHANNELS AND A REGISTRATION (G108). The user: "the fuselage projection
// and the fin projection should be one if possible. The wing and the slabs
// projection should [be] another, fully independent one, allowing its own
// projection and image and settings."
//
// EVERY KEY BELOW THAT EXISTED BEFORE MEANS EXACTLY WHAT IT MEANT, and the
// new ones default to the old behaviour — `spec.finish.decals` stores
// DEVIATIONS from these values, so a build saved last week still describes
// the same aeroplane. That is why the body channel is still spelt `img*`
// rather than renamed to something tidier.
// THE DEFAULTS MOVED (G160) to src/viewer/aeroskin.js as AERO_DEC_DEF, because
// `finish.decals` stores DEVIATIONS and the flight side needs the same thing to
// deviate from — and this file is not in the flight bundle. The keys and their
// meanings are unchanged; the commentary that explains each one moved with it.
// reached through `window` and not as a bare name: the editor is its own
// bundle and a bare `AEROSKIN` is not in its scope even when the object exists.
const DEC = (typeof window !== 'undefined' && window.AEROSKIN
             && window.AEROSKIN.AERO_DEC_DEF)
  ? JSON.parse(JSON.stringify(window.AEROSKIN.AERO_DEC_DEF))
  : {
  reg: null,              // filled from the spec's own meta on first build
  regH: 0.30,             // 300 mm is the legal marking height in most places
  regL: 2.10, regC: 0.28, // metres aft of the firewall, metres above the waist
  regTarget: 0,           // 0 fuselage, 1 flying surfaces, 2 both, 3 body+tail
  regMode: 0,             // 0 field, 1 box side view, 2 box plan view
  regRot: 0,
  // NULL FOLLOWS THE PAINT (G113.4). The glyph has always been drawn in
  // `spec.paint.trim` with a white outline, which garage.js's own legacy
  // sheet also uses — so the two could not disagree. They still cannot: null
  // means "whatever the trim is", and a number is the builder overruling it
  // for this marking only.
  regCol: null, regOut: null, regOutOn: 1,
  regMetal: 0, imgMetal: 0, wimMetal: 0,
  // INDEPENDENT WIDTH (G113.1). The width was DERIVED — `regH * aspect` —
  // and there was no way to stretch or condense a marking to fit the space
  // it has. Locked (the default, and exactly what the old code did) the
  // width still follows the height at the face's own aspect.
  regW: 0.96, regLock: 1,
  regFont: 0,             // an index into AEROSKIN.AERO_DEC_FONTS
  // THE BODY CHANNEL — fuselage, cowl, fin and stab when it is aimed there
  imgOn: 0, imgL: 1.2, imgC: 0.0, imgW: 1.2, imgH: 0.6, imgTarget: 0,
  imgMode: 0, imgRot: 0, imgLock: 1,
  // THE WING CHANNEL — its own image, its own placement, its own projection.
  // It opens in PLAN because that is what makes a stripe cross both wings as
  // one thing rather than as two mirrored halves.
  wimOn: 0, wimL: 0.0, wimC: 0.0, wimW: 2.0, wimH: 1.0,
  wimMode: 2, wimRot: 0, wimLock: 1,
};
// which surface CLASSES each `target` value means. 0/1/2 are G69's own and
// keep their meanings exactly; 3 is the one the user asked for and the old
// scalar could not express.
const DEC_ON = [
  { body: 1 },                        // 0 the fuselage
  { wing: 1, tail: 1 },               // 1 the flying surfaces
  { body: 1, wing: 1, tail: 1 },      // 2 both
  { body: 1, tail: 1 },               // 3 the body and the tail
];
const DEC_MODE = ['field', 'side', 'plan'];
const MODE_NAMES = ['round the body (field)', 'from the side (box)',
                    'from above (box)'];
const MODE_HELP =
  'FIELD wraps: metres along and around the body, which is what a fuselage ' +
  'marking must do and what a nearly flat fin cannot use. FROM THE SIDE and ' +
  'FROM ABOVE are orthographic projections through the whole craft, so one ' +
  'image runs unbroken across fuselage, cowl and fin, or across both wings.';
let decApplyRanges = () => {};
// what DEC means before anybody touches it. Frozen at module load, because
// `spec.finish` carries DEVIATIONS and a deviation needs something to deviate
// from — and because a reset has to have somewhere to reset TO.
const DEC_DEF = JSON.parse(JSON.stringify(DEC));
// THE KIT'S KEYS ARRIVE LATE, AND THEY HAVE TO (G162). This file is bundled
// AHEAD of aeroskin.js — measured rather than assumed: in index.html the
// editor block sits at 3.17 MB and `window.AEROSKIN =` at 3.54 MB — so the
// FALLBACK literal above is the branch that actually runs in the game, and
// writing the kit's forty-eight defaults into it would be a second copy of
// exactly the table G160 spent an arc reducing to one.
//
// So they are FOLDED IN the first time AEROSKIN can be reached, into DEC and
// DEC_DEF both. DEC_DEF is the one that matters: every door that saves or
// loads a marking walks `for (const k in DEC_DEF)`, so a key missing from it
// is a setting that silently does not persist — which is the shape of the bug
// G160 fixed one layer up, arriving one layer down.
//
// THREE DOORS CALL IT, and they are the three that touch DEC_DEF: the export,
// the load, and the panel. Idempotent, so calling it a fourth time costs a
// boolean.
let decKitIn = false;
function decKitDefaults() {
  if (decKitIn) return true;
  const A = AK();
  if (!A || !A.AERO_KIT_LDEF || !A.AERO_KIT_FIELDS || !A.AERO_KIT_LAYERS)
    return false;
  for (let i = 1; i <= A.AERO_KIT_LAYERS; i++)
    for (const k of A.AERO_KIT_FIELDS) {
      const key = 'm' + i + k;
      if (!(key in DEC_DEF)) DEC_DEF[key] = A.AERO_KIT_LDEF[k];
      if (!(key in DEC)) DEC[key] = A.AERO_KIT_LDEF[k];
    }
  return (decKitIn = true);
}
let decPanel = null, decImgAspect = 1;
// THE REGISTRATION IS NOT A PREFERENCE (G160). Everything else in DEC is a
// placement the builder likes and may reasonably carry from one session to the
// next; the registration is the aeroplane's IDENTITY. Stored here it was a
// third owner of one fact — a per-browser value that reapplied itself to every
// aeroplane you opened — so it is stripped on the way out and ignored on the
// way in. The spec is the owner; this key is where the SHAPE of a marking
// lives, not whose aeroplane it is.
function decLoadPrefs() {
  try {
    const j = JSON.parse(localStorage.getItem(AERO_PREF) || '{}');
    const d = Object.assign({}, j.dec || {});
    delete d.reg;
    Object.assign(DEC, d);
  } catch (e) {}
}
function decSavePrefs() {
  try {
    const j = JSON.parse(localStorage.getItem(AERO_PREF) || '{}');
    const d = Object.assign({}, DEC);
    delete d.reg;
    j.dec = d;
    localStorage.setItem(AERO_PREF, JSON.stringify(j));
  } catch (e) {}
}

// ===========================================================================
// THE FINISH BELONGS TO THE AEROPLANE (G105)
// ===========================================================================
// Everything above stores the finish in ONE localStorage key, which is right
// for a bench — one page, one aeroplane — and wrong for a fleet. In the game
// it meant every aeroplane wore the same paint: loading a second build left
// the first one's tints on it, and a build you saved and sent to somebody else
// arrived in whatever colours THEY had last used.
//
// So the finish goes into the spec, the way the shape did at G63 and by the
// same route: OUT through the join's export (`spec.finish`), IN through
// applySpec. The pref stays and stays useful — it is the working state between
// builds, and it is the bench's only home — but it is no longer the AUTHORITY.
// `finishFromSpec` is, and the first thing it does is forget.
//
// DEVIATIONS ONLY, like `cageToSpec`: a section the builder has not touched is
// a section this file does not mention, so a build goes on meaning the same
// thing when a later chantier changes what `auto` derives.
//
// ONE OBJECT PER SECTION, not five parallel maps. The five maps are the
// panel's internal shape (one per row kind); a file wants to say "this
// section, these choices", and it makes "has this section been touched at all"
// a question with an answer.
function finishToSpec() {
  decKitDefaults();
  const sections = {};
  let n = 0;
  const names = new Set([].concat(
    Object.keys(secFin), Object.keys(secTint), Object.keys(secTile),
    Object.keys(secRough), Object.keys(secNrm), Object.keys(secWear),
    Object.keys(secCc), Object.keys(secField), Object.keys(secMetal)));
  for (const nm of names) {
    const o = {};
    if (secFin[nm]) o.fin = secFin[nm];
    if (secTint[nm] != null) o.tint = secTint[nm];
    if (secTile[nm] != null) o.tile = secTile[nm];
    if (secRough[nm] != null) o.rough = secRough[nm];
    if (secNrm[nm] != null) o.nrm = secNrm[nm];
    if (secWear[nm] != null) o.wearM = secWear[nm];
    if (secCc[nm] != null) o.cc = secCc[nm];
    if (secField[nm] != null) o.field = secField[nm];
    if (secMetal[nm] != null) o.metal = secMetal[nm];
    if (Object.keys(o).length) { sections[nm] = o; n++; }
  }
  // THE GLAZING, deviations only — the same rule the sections and the decals
  // follow, so a build that never touched the glass says nothing about it and
  // goes on meaning the same thing when a later chantier changes the defaults.
  const glass = {};
  for (const k in GLASS_DEFV) if (GLASS[k] !== GLASS_DEFV[k]) glass[k] = GLASS[k];
  const decals = {};
  for (const k in DEC_DEF) if (DEC[k] !== DEC_DEF[k]) decals[k] = DEC[k];
  // THE REGISTRATION IS NOT THE FINISH'S. It is `spec.meta.reg` and has been
  // since G69 — the panel edits it, the spec owns it. Writing it here as well
  // would give one string two homes and let them disagree.
  delete decals.reg;
  const out = {};
  if (n) out.sections = sections;
  if (WEAR.amount) out.wear = WEAR.amount;
  if (Object.keys(decals).length) out.decals = decals;
  if (Object.keys(glass).length) out.glass = glass;
  return Object.keys(out).length ? out : null;
}

// ...and IN. THE RESET IS THE POINT: this runs on every load, and a load that
// only applied what the file mentions would leave the previous aeroplane's
// paint underneath — which is the bug the whole block exists to fix. Null is
// the factory finish and is a complete instruction, not a missing one.
function finishFromSpec(f) {
  decKitDefaults();
  for (const m of [secFin, secTint, secTile, secRough, secNrm, secWear,
                   secCc, secField, secMetal])
    for (const k in m) delete m[k];
  // AND THE REGISTRATION IS CLEARED WITH THE REST (G160). This used to carry
  // DEC.reg across a load, on the reasoning that it belonged to meta.reg and
  // was "not ours to clear" — but nothing wrote meta.reg, so this cache was
  // the only copy, and preserving it meant the LAST aeroplane's registration
  // followed you onto the next one. Now that the panel commits to the spec,
  // clearing is both safe and required: decReg() re-reads, and a loaded
  // aeroplane wears the letters its own file carries.
  Object.assign(DEC, JSON.parse(JSON.stringify(DEC_DEF)));
  Object.assign(GLASS, JSON.parse(JSON.stringify(GLASS_DEFV)));
  WEAR.amount = 0;
  const o = (f && typeof f === 'object' && !Array.isArray(f)) ? f : null;
  if (o) {
    const S = (o.sections && typeof o.sections === 'object') ? o.sections : {};
    for (const nm in S) {
      const r = S[nm] || {};
      if (r.fin) secFin[nm] = r.fin;
      if (typeof r.tint === 'number') secTint[nm] = r.tint;
      if (typeof r.tile === 'number') secTile[nm] = r.tile;
      if (typeof r.rough === 'number') secRough[nm] = r.rough;
      if (typeof r.nrm === 'number') secNrm[nm] = r.nrm;
      if (typeof r.wearM === 'number') secWear[nm] = r.wearM;
      if (typeof r.cc === 'number') secCc[nm] = r.cc;
      if (typeof r.field === 'number') secField[nm] = r.field;
      if (typeof r.metal === 'number') secMetal[nm] = r.metal;
    }
    if (typeof o.wear === 'number') WEAR.amount = Math.max(0, Math.min(1, o.wear));
    if (o.decals && typeof o.decals === 'object')
      for (const k in DEC_DEF) if (k !== 'reg' && o.decals[k] !== undefined)
        DEC[k] = o.decals[k];
    if (o.glass && typeof o.glass === 'object')
      for (const k in GLASS_DEFV) if (o.glass[k] !== undefined)
        GLASS[k] = o.glass[k];
  }
  aeroSavePrefs(); decSavePrefs();
  // EVERY ROW'S VALUE JUST CHANGED, and the panel only rebuilds when the
  // SECTION LIST changes shape — so loading into an aeroplane with the same
  // sections would have redrawn nothing and gone on showing the old numbers.
  // Clearing the signature is how this file already says "rebuild next time".
  matPanelSig = '';
}
// THE REGISTRATION IS THE AEROPLANE'S OWN, not a field in this panel: the
// spec already carries it (`meta.reg`, default F-PGAR) and garage.js's
// registration sheet has always read it from there. The panel edits it; the
// spec owns it.
function decReg() {
  if (DEC.reg != null) return DEC.reg;
  try {
    const S = window.GARAGE_SPEC && window.GARAGE_SPEC.get();
    const r = S && ((S.meta && S.meta.reg) || S.reg);
    if (r) return (DEC.reg = r);
  } catch (e) {}
  return (DEC.reg = 'F-PGAR');
}
function applyDecals() {
  const A = AK();
  if (!A || !A.aeroSetDecals) return;
  if (!aeroOn()) { A.aeroSetDecals(THREE, []); return; }
  const list = [];
  // page 0: the registration. Its trim colour is the paint block's, which is
  // what garage.js used, so the two paths cannot disagree about it.
  let trim = 0x1b3a5c, base = 0xf2c437;
  try {
    const S = window.GARAGE_SPEC && window.GARAGE_SPEC.get();
    if (S && S.paint) { trim = S.paint.trim; base = S.paint.base; }
  } catch (e) {}
  // ONE KEEPER FOR THE TRANSLATION (G160). This used to build the decal list
  // here, and that is why the registration never reached the flown aeroplane:
  // this function is the EDITOR's, it runs on a slider, and the flight side
  // has no editor. The list is built in aeroskin.js now and this panel calls
  // it with its LIVE state, so an un-saved drag still previews while the flown
  // aeroplane reads the same code off the saved spec.
  const R = A.aeroDecalsFor(THREE, DEC,
              { reg: decReg(), trim, base });
  ASPECT.regOn = R.aspect;
  // the lock is the panel's to display: aeroDecalsFor DERIVES the locked width
  // rather than trusting the stored one, so this only mirrors it into the row.
  if (DEC.regLock) DEC.regW = DEC.regH * Math.max(1.2, R.aspect);
  if (SYNC.regW) SYNC.regW();
  A.aeroSetDecals(THREE, R.list);
}

// ---- THE IMAGE PAGES, IN AND OUT (G190) ------------------------------------
// The body image is atlas page 1 (imgOn), the wing image page 2 (wimOn). Out:
// the pages that hold an image, as the page's own pixels plus the aspect the
// upload measured (the lock reads it), for the save envelope. In: the same
// object, baked back through aeroskin's drawer and re-applied — the flags and
// the placement come from the spec's decals, this is only the picture.
const DEC_IMG_PAGES = { 1: 'imgOn', 2: 'wimOn' };
function decalImages() {
  const A = AK();
  if (!A || !A.aeroDecalImageData) return null;
  const out = {};
  for (const pg in DEC_IMG_PAGES) {
    const d = A.aeroDecalImageData(+pg);
    if (d) out[pg] = { data: d, aspect: ASPECT[DEC_IMG_PAGES[pg]] || 1 };
  }
  return Object.keys(out).length ? out : null;
}
function decalImagesFrom(images) {
  const A = AK();
  if (!A || !A.aeroDecalImageFrom || !images || typeof images !== 'object') return 0;
  let n = 0;
  for (const pg in DEC_IMG_PAGES) {
    const rec = images[pg];
    const key = DEC_IMG_PAGES[pg];
    if (!rec || !rec.data) {
      // nothing for this page: the previous build's picture goes
      if (A.aeroDecalImageClear) { A.aeroDecalImageClear(THREE, +pg); ASPECT[key] = 1; }
      continue;
    }
    if (A.aeroDecalImageFrom(THREE, +pg, rec.data, () => {
      ASPECT[key] = +rec.aspect > 0 ? +rec.aspect : 1;
      try { applyDecals(); draw(); } catch (e) {}
    })) n++;
  }
  return n;
}

// ---- THE WEAR (G70) -------------------------------------------------------
// The dial is one number; WHERE it lands is measured off this build, every
// build. Two sources, and both are real places on the aeroplane rather than
// numbers somebody liked:
//
//   THE EXHAUST EXIT — the engine layer reads it off the pipes' own
//     triangles (aft-most, then lowest), so it follows the cylinder count,
//     the architecture and every slider on the engine panel.
//   THE WHEEL — the gear layer already publishes its contacts, and what a
//     main wheel throws up the belly starts at its own station.
//
// AND THE CONVERSION IS THE INTERESTING PART. Both are points in the scene's
// metric frame; the shader wants the SURFACE FIELD (metres aft of the
// firewall, metres around from the waist). Rather than write down where the
// firewall is a second time — the join already owns that chain, and a second
// copy is exactly how two descriptions drift apart — the point is matched to
// the NEAREST FIELDED VERTEX ON THE CAGE and that vertex's own (sL, sC) is
// read out. The aeroplane answers the question about itself, in the
// coordinate it already carries, and nothing here knows what a firewall is.
function wearFieldAt(m, FS, p) {
  if (!m || !m.A || !p) return null;
  // the mesh is in cage units and the point is in metres
  const x = p[0] / FS, y = p[1] / FS, z = p[2] / FS;
  let bi = -1, bd = Infinity;
  for (let i = 0; i < m.V.length; i++) {
    const q = m.A[i];
    if (!q || (q[0] === 0 && q[1] === 0)) continue;   // no field on this one
    const v = m.V[i];
    const dx = v[0] - x, dy = v[1] - y, dz = v[2] - z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bd) { bd = d; bi = i; }
  }
  return bi < 0 ? null : [m.A[bi][0] * FS, m.A[bi][1] * FS];
}
function applyWear(m, FS) {
  const A = AK();
  if (!A || !A.aeroSetWear) return;
  if (!aeroOn() || !(WEAR.amount > 0)) {
    A.aeroSetWear(THREE, { amount: 0 });
    return;
  }
  let exhaust = null, splash = null;
  try {
    const E = window.CAGE_ENG;
    const f = E && E.exhaustAt && wearFieldAt(m, FS, E.exhaustAt);
    // 1.6 m of run and a 90 mm plume at the source: a soot trail off a
    // stub stack reaches about the back of the cabin and spreads as it goes.
    //
    // THE RUN STARTS AT THE SKIN, and this is not a fudge — it is measured.
    // A stub stack exits FORWARD of the firewall (this build: 0.65 m
    // forward), and the streak's strongest stretch is its first third; spent
    // ahead of sL 0 that third lands on the COWL, which has no surface field
    // and cannot draw it, so what reached the fuselage was the tail of a
    // trail whose head had gone nowhere. Soot leaves the stack, is dragged
    // aft, and lands on the first thing behind it: the run starts where the
    // skin does. The plume's LENGTH is unchanged, so it still reaches the
    // same station on the aeroplane.
    if (f) exhaust = [Math.max(0, f[0]), f[1], 1.6, 0.09];
  } catch (e) {}
  try {
    const G = window.CAGE_GEAR;
    // the MAINS, not the tailwheel: the tailwheel runs in the same track the
    // mains have already sprayed, and it is 200 mm from the ground with
    // nothing above it to stain
    const c = (G && G.contacts || []).filter(u => Math.abs(u.p[0]) > 0.01);
    if (c.length) {
      const pick = c[0].p;
      const f = wearFieldAt(m, FS, pick);
      if (f) splash = [f[0], f[1], 1.2, 0.16];
    }
  } catch (e) {}
  A.aeroSetWear(THREE, { amount: WEAR.amount, exhaust, splash });
}

// A COLOUR WELL FOR ONE PANE, and the same double-click-to-clear the other
// sections' wells have — one idiom, not two.
function glassWell(row, nm) {
  const c = document.createElement('input');
  c.type = 'color'; c.style.flex = 'none';
  wellRecent(c);                                   // G156
  c.value = '#' + ((secTint[nm] != null ? secTint[nm] : GLASS.tint != null
                    ? GLASS.tint : 0xaec9d8) >>> 0).toString(16).padStart(6, '0');
  c.title = 'the tint of this pane';
  c.oninput = () => { secTint[nm] = parseInt(c.value.slice(1), 16);
    aeroSavePrefs(); build(); };
  const k = row.querySelector('span.k');
  if (k) { k.style.cursor = 'pointer';
    k.ondblclick = () => { delete secTint[nm];
      c.value = '#' + ((GLASS.tint != null ? GLASS.tint : 0xaec9d8) >>> 0)
        .toString(16).padStart(6, '0');
      aeroSavePrefs(); build(); }; }
  row.appendChild(c);
}

let matPanel = null, matPanelBody = null, matPanelSig = '';
// the value-only refresh for builds where the panel's SHAPE is unchanged:
// today that is the colour wells of rows following an ancestor's tint —
// dragging the fuselage's colour must repaint the wing's well without
// rebuilding a panel of selects under the cursor
let matPanelSync = [];
function syncMatPanel() {
  for (const f of matPanelSync) try { f(); } catch (e) {}
}
// built ONCE, and in its own <details> so the section list rebuilding under
// it cannot wipe a text field the user is typing into
// the panel's own little registries: a value re-sync per key (so a locked
// ratio can move the slider it owns), a grey-out per key, and the ratio rule
// itself. They live here rather than inside the builder because `decRange`
// and `applyDecals` are called from the build and the builder runs once.
const SYNC = {}, GREY = {}, LOCK = {};
// ---- SWITCHING PROJECTION KEEPS THE MARKING WHERE IT IS (G113.4) ---------
// MEASURED, and it settles this the other way round from how it was planned.
// The two frames do NOT differ by a constant anybody forgot to plumb: over
// the cage's own fielded vertices the offset between craft space and the
// field spreads 2.32 m along the body and 1.25 m around the section. That is
// because `sL` and `sC` are ARC LENGTHS on a curved surface and the box
// coordinates are a straight projection — the difference IS wrapping versus
// projecting, which is the whole reason both modes exist. No shared origin
// can reconcile them and one would be a lie.
//
// So the numbers are allowed to differ and the MARKING is what is preserved:
// on a mode change, find the point the decal currently sits on and re-read
// its coordinate in the frame being switched to. The mesh is the dictionary —
// its vertices carry both the field (`aStruct`) and the position — so this is
// a lookup, not a formula.
function decReframe(fromMode, toMode, keys) {
  if (fromMode === toMode) return;
  const S = (typeof window !== 'undefined') && window.CAGE_UI_SCENE;
  if (!S || typeof THREE === 'undefined') return;
  let mesh = null;
  S.traverse(o => { if (!mesh && o.isMesh && o.userData && o.userData.matNames &&
    o.geometry && o.geometry.attributes.aStruct) mesh = o; });
  if (!mesh) return;
  const A = mesh.geometry.attributes.aStruct, P = mesh.geometry.attributes.position;
  S.updateWorldMatrix(true, false); mesh.updateWorldMatrix(true, false);
  const toCraft = new THREE.Matrix4().copy(S.matrixWorld).invert()
                    .multiply(mesh.matrixWorld);
  const F = fieldM();
  const v = new THREE.Vector3();
  // the frame a mode reads a decal's centre in: 0 the field, 1 the flank
  // (along, up), 2 the plan (lateral, along) — all in metres
  const coord = (mode, i) => {
    if (mode === 0) return [A.getX(i) * F, A.getY(i) * F];
    v.fromBufferAttribute(P, i).applyMatrix4(toCraft);
    return mode === 1 ? [-v.z, v.y] : [v.x, -v.z];
  };
  const want = [DEC[keys.l], DEC[keys.c]];
  let best = -1, bestD = 1e9;
  for (let i = 0; i < A.count; i++) {
    if (A.getX(i) === 0 && A.getY(i) === 0) continue;   // unfielded vertex
    const c = coord(fromMode, i);
    const d = (c[0]-want[0])*(c[0]-want[0]) + (c[1]-want[1])*(c[1]-want[1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) return;
  const to = coord(toMode, best);
  DEC[keys.l] = +to[0].toFixed(3);
  DEC[keys.c] = +to[1].toFixed(3);
  if (SYNC[keys.l]) SYNC[keys.l]();
  if (SYNC[keys.c]) SYNC[keys.c]();
}
// ---- THE GLAZING (G113.2) -------------------------------------------------
// ONE set of dials for every pane, not one per section, and the reason is the
// aeroplane rather than the code: a windscreen and a skylight on the same
// machine are the same glass, cut twice. Per-section tint stays per-section
// (that is `secTint`, which glass has always been able to take and never had
// a well for); what is shared is the CONDITION of the glazing.
// G206: opacity 0.5 -> 0.2 with the hand blend — see aeroskin.js GLASS_DEF
const GLASS = { tint: null, opacity: 0.2, scratch: 0, wipe: 0, grime: 0,
                refl: 1, rainbow: 0 };
const GLASS_DEFV = JSON.parse(JSON.stringify(GLASS));

// THE MATERIAL LAB'S OWN DOM (G206). Re-rendered on its own whenever its
// selection changes; the panel rebuild around it happens only when the
// section list changes shape. Sliders write LIVE (uniforms and scalars, no
// rebuild); `cc` rebuilds on release because a clear coat appearing on a row
// changes the material class; the resets rebuild too.
const LAB = { kind: 'finish', key: null, gkey: null, open: false };
// WHAT THIS AEROPLANE WEARS (G206.3, the user: "I can't see a single thing
// moving from any slider in finish rows and construction rows" — the lab
// opened on doped fabric and tube + fabric, and the aeroplane was ply on a
// wood construction; every slider was editing a row nothing on the stand
// wore). The finish select now opens on the FUSELAGE'S finish, the
// construction select on the build's, and rows in use are marked.
function labUsed() {
  const fins = new Set(), grms = new Set();
  const sc = (typeof window !== 'undefined') && window.CAGE_UI_SCENE;
  if (sc) sc.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material
             : (o.material ? [o.material] : []);
    for (const m of ms) {
      const u = m && m.userData;
      if (!u) continue;
      if (u.aeroFinish) fins.add(u.aeroFinish);
      if (u.aeroGrm && u.aeroStruct) grms.add(u.aeroGrm);
    }
  });
  return { fins, grms };
}
function labRender(box) {
  const A = AK();
  if (!A || !A.aeroLabSet) return;
  box.textContent = '';
  const used = labUsed();
  if (!LAB.key) LAB.key = secFin.body || A.aeroFinishFor('body', consOf());
  if (!LAB.gkey) LAB.gkey = consOf();
  const sel = (opts, val, on) => {
    const s = document.createElement('select'); s.style.flex = '1';
    for (const [v, t] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; s.appendChild(o);
    }
    s.value = val; s.onchange = () => on(s.value); return s;
  };
  const row = (label, title) => {
    const r = document.createElement('div'); r.className = 'r dial';
    const k = document.createElement('span');
    k.className = 'k'; k.textContent = label; k.title = title || label;
    r.appendChild(k); box.appendChild(r); return r;
  };
  const btn = (t, on) => {
    const b = document.createElement('button'); b.textContent = t;
    b.style.cssText = 'font:inherit;font-size:10px;padding:1px 6px;';
    b.onclick = on; return b;
  };
  const head = row('table', 'which table this bench is over');
  head.appendChild(sel([['finish', 'finish rows'],
                        ['grammar', 'construction rows'],
                        ['gain', 'display gains'],
                        ['glass', 'glazing base']],
                       LAB.kind, v => { LAB.kind = v; labRender(box); }));
  let fields, get, set, key = null;
  const fmt = v => v == null ? '-'
    : (Math.abs(v) < 0.02 && v !== 0) ? (v * 1000).toFixed(2) + ' mm'
    : (+v).toFixed(3);
  if (LAB.kind === 'finish') {
    const keys = Object.keys(A.AERO_FINISH);
    if (!A.AERO_FINISH[LAB.key]) LAB.key = keys[0];
    const kr = row('finish', 'the row being edited (* = deviates; ' +
                   '\u2022 = on this aeroplane)');
    kr.appendChild(sel(keys.map(k => [k, A.AERO_FINISH[k].name +
                                          (used.fins.has(k) ? ' \u2022' : '') +
                                          (A.AERO_LAB.finish[k] ? ' *' : '')]),
                       LAB.key, v => { LAB.key = v; labRender(box); }));
    key = LAB.key; fields = A.AERO_LAB_FIELDS;
    get = f => A.aeroLabGet('finish', key, f);
    set = (f, v) => A.aeroLabSet(THREE, 'finish', key, f, v);
  } else if (LAB.kind === 'grammar') {
    const D = A.aeroGramDef() || {};
    const keys = Object.keys(D);
    if (!keys.length) { row('(the core is not loaded)', ''); return; }
    if (!D[LAB.gkey]) LAB.gkey = keys[0];
    const kr = row('construction', 'the construction row (* = deviates; ' +
                   '\u2022 = this build)');
    kr.appendChild(sel(keys.map(k => [k, (D[k].name || k) +
                                         (used.grms.has(k) ? ' \u2022' : '') +
                                         (A.AERO_LAB.grammar[k] ? ' *' : '')]),
                       LAB.gkey, v => { LAB.gkey = v; labRender(box); }));
    key = LAB.gkey; fields = A.AERO_LAB_GRAM;
    get = f => A.aeroLabGet('grammar', key, f);
    set = (f, v) => A.aeroLabSet(THREE, 'grammar', key, f, v);
  } else if (LAB.kind === 'gain') {
    fields = A.AERO_LAB_GAIN;
    get = f => A.aeroLabGet('gain', f);
    set = (f, v) => A.aeroLabSet(THREE, 'gain', f, f, v);
  } else {
    fields = A.AERO_LAB_GLASS;
    get = f => A.aeroLabGet('glass', f);
    set = (f, v) => A.aeroLabSet(THREE, 'glass', f, f, v);
  }
  for (const f in fields) {
    const [lo, hi, st, label] = fields[f];
    const v0 = get(f);
    if (v0 == null) continue;          // a construction with no such row
    const r = row('  ' + label, f);
    const i = document.createElement('input');
    i.type = 'range'; i.min = lo; i.max = hi; i.step = st;
    i.value = v0; i.style.flex = '1';
    const v = document.createElement('span');
    v.className = 'v'; v.textContent = fmt(+v0);
    i.oninput = () => { set(f, +i.value); v.textContent = fmt(+i.value); };
    if (f === 'cc') i.onchange = () => build();
    r.appendChild(i); r.appendChild(v);
  }
  const foot = row('', '');
  foot.appendChild(btn('reset row', () => {
    A.aeroLabReset(THREE, LAB.kind, key); build(); labRender(box); }));
  foot.appendChild(btn('reset all', () => {
    A.aeroLabReset(THREE); build(); labRender(box); }));
  foot.appendChild(btn(LAB.open ? 'hide json' : 'export json', () => {
    LAB.open = !LAB.open; labRender(box); }));
  if (LAB.open) {
    const ta = document.createElement('textarea'); ta.readOnly = true;
    ta.style.cssText = 'flex:1 1 100%;height:110px;font:10px/1.3 monospace;';
    ta.value = A.aeroLabExport(); box.appendChild(ta);
    try { if (navigator.clipboard) navigator.clipboard.writeText(ta.value); }
    catch (e) {}
  }
}
// the pane's own extent in field metres, measured off the drawn mesh so
// "toward the edge" is a real distance on a real pane
const GLASS_EXT = {};
// the measured aspect of whatever each channel is currently drawing, so a
// locked ratio has something to be locked TO. The registration's is measured
// by the text baker on every applyDecals; an image's is measured on load.
const ASPECT = {};
// the build's own size, re-read every rebuild
let decSpan = { len: 6, span: 10, up: 2 };
function decRange() {
  const S = (typeof window !== 'undefined') && window.CAGE_UI_SCENE;
  if (!S || typeof THREE === 'undefined' || !THREE.Box3) return;
  try {
    const b = new THREE.Box3().setFromObject(S);
    if (!isFinite(b.min.x) || b.isEmpty()) return;
    const d = b.getSize(new THREE.Vector3());
    // the cage frame's lateral axis is x; along is z, up is y
    decSpan = { span: Math.max(1, d.x), len: Math.max(1, d.z),
                up: Math.max(0.5, d.y) };
  } catch (e) {}
}
function buildDecPanel() {
  const A = AK();
  if (!A || decPanel) return;
  decKitDefaults();
  decLoadPrefs();
  decPanel = document.createElement('details');
  decPanel.dataset.g = 'decals';
  decPanel.innerHTML = '<summary>decals</summary>';
  const body = document.createElement('div');
  decPanel.appendChild(body);
  ui.insertBefore(decPanel, lg);
  // the optional PARENT is what lets the kit put its layers in nested
  // <details> instead of adding forty-two rows to one flat panel
  // WHICH BLOCK A ROW BELONGS TO (G207, the user: "the marking and livery
  // section needs its controls reorganized ... separating clearly the
  // registration, the livery system, the body and the wing sections"). Every
  // row carries `data-dec`, and the game's FINISH view emits one heading per
  // block instead of one for the lot. The bench's flat panel is unchanged.
  const DECG = { cur: 'reg' };
  const row = (label, title, parent) => {
    const d = document.createElement('div'); d.className = 'r';
    d.dataset.dec = DECG.cur;
    const k = document.createElement('span');
    k.className = 'k'; k.textContent = label; k.title = title || label;
    d.appendChild(k); (parent || body).appendChild(d); return d;
  };
  // WHAT A SLIDER MAY REACH IS THE AEROPLANE'S OWN SIZE (G108). The image
  // width was capped at a literal 4.0 m — the user: "the image max width is
  // insufficient to cover the full plane" — and 4 m is a number that was
  // right for one aeroplane. `decRange` re-reads the build's own extent on
  // every rebuild and moves the bounds with it, so a 16 m biplane and a 6 m
  // single-seater both get a slider that reaches their own tips.
  const ranged = [];
  const num = (lab, key, lo, hi, step, title, span, parent) => {
    const d = row(lab, title, parent);
    const i = document.createElement('input');
    i.type = 'range'; i.min = lo; i.max = hi; i.step = step;
    i.value = DEC[key]; i.style.flex = '1';
    const v = document.createElement('span');
    v.className = 'v'; v.textContent = (+DEC[key]).toFixed(2);
    i.oninput = () => { DEC[key] = +i.value; v.textContent = (+i.value).toFixed(2);
      if (LOCK[key]) LOCK[key]();
      decSavePrefs(); applyDecals(); draw(); };
    d.appendChild(i); d.appendChild(v);
    if (span) ranged.push({ i, v, key, span, lo });
    SYNC[key] = () => { i.value = DEC[key]; v.textContent = (+DEC[key]).toFixed(2); };
    GREY[key] = on => { i.disabled = !on; d.style.opacity = on ? '' : '.45'; };
    return d;
  };
  const flag = (lab, key, title, onChange, parent) => {
    const d = row(lab, title, parent);
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = !!DEC[key];
    c.onchange = () => { DEC[key] = c.checked ? 1 : 0;
      decSavePrefs(); if (onChange) onChange(); applyDecals(); draw(); };
    d.appendChild(c);
    return d;
  };
  const pick = (lab, key, names, title, onChange, parent) => {
    const d = row(lab, title, parent);
    const sel2 = document.createElement('select'); sel2.style.flex = '1';
    names.forEach((n, i) => { const o = document.createElement('option');
      o.value = i; o.textContent = n; sel2.appendChild(o); });
    sel2.value = DEC[key];
    sel2.onchange = () => {
      const was = +DEC[key];
      DEC[key] = +sel2.value;
      if (onChange) onChange(was, +sel2.value);
      decSavePrefs(); applyDecals(); draw();
    };
    d.appendChild(sel2);
    return d;
  };
  // the registration
  {
    const d = row('registration', 'the aeroplane\'s own marking — the spec ' +
      'carries it as meta.reg and this edits it');
    const i = document.createElement('input');
    i.type = 'text'; i.value = decReg(); i.style.flex = '1';
    i.spellcheck = false;
    // THE SPEC OWNS IT, AND NOW SOMETHING ACTUALLY WRITES IT (G160). The row
    // above has always said "the spec carries it as meta.reg and this edits
    // it" and that was simply not true: `oninput` set DEC.reg — an editor
    // cache and a browser pref — and nothing ever put the letters into the
    // spec. So a registration typed here repainted the garage, was never
    // saved with the build, and could not reach the flown aeroplane even
    // after the flight side learned to read it. That is the whole of the
    // user's "the registration did not make it in-game intact, my settings
    // affected only the garage", and their build file proves it: meta.reg is
    // still the default F-PGAR under a thoroughly customised aeroplane.
    //
    // TWO EVENTS, DELIBERATELY. `oninput` keeps the live repaint, because a
    // marking you cannot see while typing is worse than one you cannot save.
    // The commit goes on `change` (blur or Enter): GARAGE_SPEC.update REBUILDS
    // the aeroplane, and doing that per keystroke would tear down and re-derive
    // the whole cage for every letter of a registration.
    i.oninput = () => { DEC.reg = i.value.toUpperCase(); i.value = DEC.reg;
      decSavePrefs(); applyDecals(); draw(); };
    i.onchange = () => {
      const v = i.value.toUpperCase().trim();
      DEC.reg = v; i.value = v; decSavePrefs();
      try {
        const G = (typeof window !== 'undefined') && window.GARAGE_SPEC;
        if (G && G.update) G.update({ meta: { reg: v } });
        else { applyDecals(); draw(); }      // the bench has no spec store
      } catch (e) { applyDecals(); draw(); }
    };
    d.appendChild(i);
  }
  // G207: these are the GLYPHS' height and width now (the page was a
  // quarter empty above and below the letters), so the ranges are letter
  // sizes — 50 mm to 1.2 m tall, up to 3 m wide — and the width no longer
  // follows the fuselage length
  num('height', 'regH', 0.05, 1.20, 0.01, 'metres — 300 mm is the usual legal size');
  num('width', 'regW', 0.10, 3.0, 0.02,
      'metres. Locked, this follows the height at the face aspect; unlocked ' +
      'it condenses or stretches the marking to fit the space it has');
  // THE MARKING'S OWN COLOURS. Null follows the paint's trim (and white), so
  // an aeroplane that never touches these looks exactly as it always has;
  // double-click the label to go back to following.
  {
    const well = (lab, key, dflt, title) => {
      const d = row(lab, title);
      const c = document.createElement('input');
      c.type = 'color'; c.style.flex = 'none';
      wellRecent(c);                               // G156
      const cur = () => {
        if (DEC[key] != null) return DEC[key];
        try { const S = window.GARAGE_SPEC && window.GARAGE_SPEC.get();
          if (S && S.paint && key === 'regCol') return S.paint.trim; } catch (e) {}
        return dflt;
      };
      const paint = () => { c.value = '#' + (cur() >>> 0).toString(16).padStart(6, '0'); };
      paint();
      c.oninput = () => { DEC[key] = parseInt(c.value.slice(1), 16);
        decSavePrefs(); applyDecals(); draw(); };
      const k = d.querySelector('span.k');
      if (k) { k.style.cursor = 'pointer';
        k.ondblclick = () => { DEC[key] = null; paint();
          decSavePrefs(); applyDecals(); draw(); }; }
      d.appendChild(c);
    };
    well('ink', 'regCol', 0x1b3a5c,
         'the glyph. Unset it follows the aeroplane trim colour — ' +
         'double-click the label to go back to following');
    // G214: the keyline is optional
    flag('outline on', 'regOutOn',
         'a keyline around the glyphs; off, the ink alone');
    well('outline', 'regOut', 0xffffff,
         'the keyline around the glyph, which is what keeps a dark ' +
         'registration legible on a dark flank');
  }
  pick('face', 'regFont', (A.AERO_DEC_FONTS || []).map(f => f.name),
       'only the faces the artifact ships: a livery that renders in a ' +
       'different font on somebody else machine is not a livery');
  num('station', 'regL', -1.0, 6.0, 0.05, 'metres AFT of the firewall', 'len');
  num('height on side', 'regC', -1.0, 1.2, 0.02,
      'metres around the section from the waist rail, + upward', 'up');
  num('turn', 'regRot', -0.6, 0.6, 0.01, 'radians — the atlas has always ' +
      'carried a rotation and nothing ever offered it');
  num('metallic', 'regMetal', 0, 1, 0.02,
      'metal flake in the ink — the letters become paint with flake in it');
  pick('goes on', 'regTarget',
       ['the fuselage', 'the flying surfaces', 'both', 'the body & the tail'],
       'a decal is on BOTH flanks by construction — the surface field is ' +
       'mirrored about the spine, which is what a registration wants');
  pick('projected as', 'regMode', MODE_NAMES, MODE_HELP,
       (a, b) => decReframe(a, b, { l: 'regL', c: 'regC' }));

  // ---- THE MARKING KIT (G162) --------------------------------------------
  // Three layers, each its own <details>, and every row GENERATED from
  // AERO_KIT's own table rather than typed out here. That is not tidiness: a
  // pattern declares its two knobs' names, ranges and defaults and its colour
  // slots' names, so a pattern that arrives without them cannot get a panel,
  // and a panel cannot go on offering a knob a pattern stopped having.
  //
  // THE KIT IS FIRST IN THE PAINT ORDER and LAST-BUT-ONE in the panel, which
  // is deliberate: the registration is the row people open this panel for, and
  // the image channels below are the ones almost nobody uses.
  DECG.cur = 'kit';
  if (A.AERO_KIT && A.AERO_KIT_LAYERS) {
    const KIT = A.AERO_KIT;
    const patOf = key => KIT[Math.max(0, Math.min(KIT.length - 1,
                           Math.round(+DEC[key] || 0)))];
    const hexOf = v => '#' + ((v == null ? 0 : v) >>> 0).toString(16)
                              .padStart(6, '0');
    for (let li = 1; li <= A.AERO_KIT_LAYERS; li++) {
      const q = 'm' + li;
      const det = document.createElement('details');
      det.dataset.g = 'livery/' + li;
      det.dataset.dec = 'kit';
      const sum = document.createElement('summary');
      det.appendChild(sum); body.appendChild(det);
      // WHAT THE PATTERN CHANGES, collected rather than chased: a colour slot
      // that has to relabel, a knob that has to re-range, a help string that
      // has to follow. One list, one call, and no row can be forgotten in the
      // handler of a pattern added later.
      const refresh = [];
      const say = () => {
        const on = !!DEC[q + 'On'];
        sum.textContent = 'livery ' + li + ' — ' +
          (on ? patOf(q + 'Pat').name : 'off');
        sum.style.opacity = on ? '' : '.55';
      };
      const redo = () => { for (const f of refresh) f(); say(); };

      flag('on', q + 'On', 'paint this layer onto the aeroplane',
           () => { if (DEC[q + 'On']) det.open = true; redo(); }, det);
      const pd = pick('pattern', q + 'Pat', KIT.map(k => k.name), '',
        () => {
          // THE KNOBS ARE CLEARED, NOT CARRIED. 8 squares and a 0.08 bend are
          // not the same number wearing two labels, and a knob carried across
          // a pattern change is how a chequer becomes a one-square sweep.
          // null is "this pattern's own default", which is the only thing a
          // shared value can honestly mean here.
          DEC[q + 'P'] = null; DEC[q + 'Q'] = null;
          redo();
        }, det);
      refresh.push(() => {
        const k = pd.querySelector('span.k'), pat = patOf(q + 'Pat');
        if (k) k.title = pat.help || pat.name;
      });

      // the colour slots the CURRENT pattern actually has: a cheat line takes
      // a band and a keyline, a twin stripe takes three, and a slot a pattern
      // does not read is hidden rather than greyed — there is no colour there
      // to be disabled.
      const kwell = (slot, key) => {
        const d = row('', '', det);
        const kk = d.querySelector('span.k');
        const c = document.createElement('input');
        c.type = 'color'; c.style.flex = 'none';
        wellRecent(c);                                   // G156
        c.value = hexOf(DEC[key]);
        c.oninput = () => { DEC[key] = parseInt(c.value.slice(1), 16);
          decSavePrefs(); applyDecals(); draw(); };
        d.appendChild(c);
        refresh.push(() => {
          const pat = patOf(q + 'Pat'), nm = pat.cn && pat.cn[slot];
          d.style.display = nm ? '' : 'none';
          if (nm && kk) { kk.textContent = nm; kk.title = nm + ' — ' + pat.name; }
          c.value = hexOf(DEC[key]);
        });
      };
      kwell(0, q + 'A'); kwell(1, q + 'B'); kwell(2, q + 'D');

      // THE TWO KNOBS, re-ranged and relabelled from the table on every
      // pattern change. A slider that keeps 0..0.6 while the pattern under it
      // counts squares is a control that lies, and this panel has no room for
      // one: aeroKitKnob is the same clamp the drawing uses, so what the row
      // shows is what the page gets.
      const knob = j => {
        const key = q + (j ? 'Q' : 'P');
        const d = row('', '', det);
        const kk = d.querySelector('span.k');
        const i = document.createElement('input');
        i.type = 'range'; i.style.flex = '1';
        const v = document.createElement('span'); v.className = 'v';
        const show = () => {
          const pat = patOf(q + 'Pat'), kd = pat.k && pat.k[j];
          if (!kd) { d.style.display = 'none'; return; }
          d.style.display = '';
          if (kk) { kk.textContent = kd.n; kk.title = kd.n + ' — ' + pat.name; }
          i.min = kd.lo; i.max = kd.hi; i.step = kd.st;
          const cur = A.aeroKitKnob(pat, j, DEC[key]);
          i.value = cur;
          v.textContent = kd.st >= 1 ? String(Math.round(cur)) : cur.toFixed(2);
        };
        i.oninput = () => { DEC[key] = +i.value; show();
          decSavePrefs(); applyDecals(); draw(); };
        d.appendChild(i); d.appendChild(v);
        refresh.push(show);
      };
      knob(0); knob(1);

      num('opacity', q + 'Alp', 0, 1, 0.02,
          'a transparent layer lets what is under it through — which is how ' +
          'two kit layers read as one scheme instead of two stickers',
          null, det);
      num('metallic', q + 'Metal', 0, 1, 0.02,
          'metal flake in this layer\'s paint', null, det);
      flag('mirror', q + 'Flip',
           'flip the pattern fore-and-aft. A sweep that rises AFT becomes one ' +
           'that rises FORE, and it is the same pattern either way',
           null, det);
      num('station', q + 'L', -1.0, 6.0, 0.05,
          'metres AFT of the firewall', 'len', det);
      num('height on side', q + 'C', -1.2, 1.2, 0.02,
          'metres around the section from the waist rail, + upward', 'up', det);
      num('length', q + 'W', 0.10, 6.0, 0.05,
          'metres the pattern is stretched over, nose to tail', 'len', det);
      num('depth', q + 'H', 0.05, 3.0, 0.02,
          'metres the pattern is stretched over, top to bottom', 'up', det);
      num('turn', q + 'Rot', -0.6, 0.6, 0.01, 'radians', null, det);
      pick('goes on', q + 'Tgt',
           ['the fuselage', 'the flying surfaces', 'both', 'the body & the tail'],
           'a kit layer lands on BOTH flanks by construction, like every ' +
           'decal in this panel', null, det);
      pick('projected as', q + 'Mode', MODE_NAMES, MODE_HELP,
           (was, now) => decReframe(was, now, { l: q + 'L', c: q + 'C' }), det);
      redo();
    }
  }

  // ---- ONE CHANNEL PER SUBJECT (G108) ------------------------------------
  // The user: "the fuselage projection and the fin projection should be one
  // if possible. The wing and the slabs projection should [be] another, fully
  // independent one, allowing its own projection and image and settings."
  //
  // Each channel takes an image, a projection and a placement of its own. The
  // BODY's reaches the fuselage, the cowl and the tail; the WING's reaches the
  // wing and its slabs and nothing else.
  const channel = (tag, keys, page, help) => {
    const h = row(tag, help);
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'image/*'; f.style.flex = '1';
    f.onchange = () => {
      const file = f.files && f.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          ASPECT[keys.on] = A.aeroDecalImage(THREE, page, im) || 1;
          DEC[keys.on] = 1;
          if (DEC[keys.lock]) {
            DEC[keys.h] = DEC[keys.w] / Math.max(0.05, ASPECT[keys.on]);
            if (SYNC[keys.h]) SYNC[keys.h]();
          }
          decSavePrefs(); applyDecals(); draw();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    };
    h.appendChild(f);
  };
  // THE RATIO LOCK, and it closes a live bug rather than only adding a row.
  // The image height was computed ONCE, when the image loaded, and never
  // again — so dragging the width STRETCHED the picture, and there was no
  // height control to put it back with. The user reported the missing
  // control; the stretch was the other half of the same defect. Locked (the
  // default, and what the old code always did) the height follows the width
  // at the image's own aspect; unlocked both are free, and the greyed slider
  // is what says which of the two is being driven.
  const lockPair = keys => {
    const apply = () => {
      const on = !!DEC[keys.lock];
      if (GREY[keys.h]) GREY[keys.h](!on);
      if (on) {
        DEC[keys.h] = DEC[keys.w] / Math.max(0.05, ASPECT[keys.on] || 1);
        if (SYNC[keys.h]) SYNC[keys.h]();
      }
    };
    LOCK[keys.w] = () => { if (DEC[keys.lock]) apply(); };
    return apply;
  };

  // THE REGISTRATION'S LOCK RUNS THE OTHER WAY, and that is not an
  // inconsistency: a marking is specified by its legal HEIGHT ("300 mm is the
  // usual"), so height drives width here where an image's width drives its
  // height. The greyed slider is what says which of the pair is the input.
  {
    const apply = () => {
      const on = !!DEC.regLock;
      if (GREY.regW) GREY.regW(!on);
      if (on) { DEC.regW = DEC.regH * Math.max(1.2, ASPECT.regOn || 3.2);
                if (SYNC.regW) SYNC.regW(); }
    };
    LOCK.regH = () => { if (DEC.regLock) apply(); };
    flag('lock ratio', 'regLock',
         'hold the face aspect: the width follows the height', apply);
    apply();
  }

  const BODY = { on: 'imgOn', w: 'imgW', h: 'imgH', lock: 'imgLock' };
  const WING = { on: 'wimOn', w: 'wimW', h: 'wimH', lock: 'wimLock' };

  DECG.cur = 'body';
  channel('body image', BODY, 1,
          'one image across the fuselage, the cowl and the tail');
  num('body width', 'imgW', 0.1, 4.0, 0.05, 'metres', 'len');
  num('body height', 'imgH', 0.1, 4.0, 0.05, 'metres', 'up');
  const bodyLock = lockPair(BODY);
  flag('body lock ratio', 'imgLock',
       'hold the image aspect: the height follows the width', bodyLock);
  num('body station', 'imgL', -1.0, 6.0, 0.05, 'metres AFT of the firewall', 'len');
  num('body height on side', 'imgC', -1.2, 1.2, 0.02, 'metres from the waist', 'up');
  num('body turn', 'imgRot', -0.6, 0.6, 0.01, 'radians');
  num('body metallic', 'imgMetal', 0, 1, 0.02, 'metal flake where the image paints');
  pick('body goes on', 'imgTarget',
       ['the fuselage', 'the flying surfaces', 'both', 'the body & the tail']);
  pick('body projected as', 'imgMode', MODE_NAMES, MODE_HELP,
       (a, b) => decReframe(a, b, { l: 'imgL', c: 'imgC' }));

  DECG.cur = 'wing';
  channel('wing image', WING, 2,
          'one image across the wing and its slabs, independent of the body');
  num('wing width', 'wimW', 0.1, 4.0, 0.05, 'metres', 'span');
  num('wing height', 'wimH', 0.1, 4.0, 0.05, 'metres', 'len');
  const wingLock = lockPair(WING);
  flag('wing lock ratio', 'wimLock',
       'hold the image aspect: the height follows the width', wingLock);
  num('wing across', 'wimL', -6.0, 6.0, 0.05,
      'metres from the centreline, in PLAN', 'span');
  num('wing along', 'wimC', -3.0, 3.0, 0.02, 'metres fore and aft, in PLAN', 'len');
  num('wing turn', 'wimRot', -0.6, 0.6, 0.01, 'radians');
  num('wing metallic', 'wimMetal', 0, 1, 0.02, 'metal flake where the image paints');
  pick('wing projected as', 'wimMode', MODE_NAMES, MODE_HELP,
       (a, b) => decReframe(a, b, { l: 'wimL', c: 'wimC' }));
  // THE CERTIFICATION STICKERS (G208.2, the user: "we should be able to
  // choose where certification stickers are applied, and maybe move them
  // manually a little (like the fuel tanks, default section + manual fine
  // tuning)"). A place from stickers.js's own table, then metres of fine
  // tuning off that place's station — the tank's bay-plus-offset grammar.
  DECG.cur = 'stk';
  const STK = (window.STICKERS && window.STICKERS.PLACES) || [];
  flag('stickers shown', 'stkOn',
       'the bench\'s certification roundels, one per passed test; off hides them');
  pick('stickers go on', 'stkPlace', STK.map(p => p.name),
       'the place the strip is worn — its own station and height; the two rows below fine-tune from there');
  num('stickers along', 'stkL', -3.0, 3.0, 0.02, 'metres fore (-) or aft (+) of the place\'s own station', 'len');
  num('stickers up', 'stkC', -1.0, 1.0, 0.02, 'metres below (-) or above (+) the place\'s own height', 'up');
  num('sticker size', 'stkSize', 0.06, 0.30, 0.01, 'the roundel\'s diameter, metres (120 mm is a real placard)');
  num('stickers turn', 'stkRot', -0.6, 0.6, 0.01, 'radians');
  bodyLock(); wingLock();

  // WHAT A SLIDER MAY REACH IS THE AEROPLANE'S OWN SIZE. The image width was
  // capped at a literal 4.0 m — the user: "the image max width is
  // insufficient to cover the full plane" — and 4 m is a number that was
  // right for one aeroplane. These bounds are re-read from the build's own
  // extent on every rebuild, so a 16 m biplane and a 6 m single-seater each
  // get a slider that reaches their own tips.
  decApplyRanges = () => {
    for (const r of ranged) {
      const m = Math.max(r.lo + 0.1, +(decSpan[r.span] * 1.1).toFixed(2));
      r.i.max = m;
      if (+r.i.min < 0) r.i.min = -m;
    }
  };
  decApplyRanges();
}

function buildMatPanel() {
  const A = AK();
  if (!A) return;
  buildDecPanel();
  if (!matPanel) {
    matPanel = document.createElement('details');
    matPanel.dataset.g = 'materials';
    matPanel.innerHTML = '<summary>materials</summary>';
    matPanelBody = document.createElement('div');
    matPanel.appendChild(matPanelBody);
    ui.insertBefore(matPanel, lg);
  }
  // only rebuild the DOM when the section list actually changes: this runs
  // after every build, and a slider drag must not rebuild a panel of selects
  // under the user's cursor
  const names = Object.keys(matSurf).sort();
  // ...then the LAYER sections this build actually drew (secMat's stamps),
  // after the cage's own. The signature carries each one's RESOLVED
  // auto-finish and its source — an override on `body` must relabel every
  // `auto (follows …)` under it — but never a tint: a colour drag must not
  // rebuild DOM under an open native picker (syncMatPanel covers the wells).
  const live = Object.keys(SEC_LIVE).sort();
  const sig = names.join(',') + '|' + consOf() + '|' +
    live.map(n => { const r = secResolveAuto(n);
                    return n + ':' + r.fin + ':' + (r.src || ''); }).join(',');
  if (sig === matPanelSig) { syncMatPanel(); return; }
  matPanelSig = sig;
  matPanelBody.textContent = '';
  matPanelSync = [];
  const cons = consOf();
  const mkRow2 = (label, title) => {
    const d = document.createElement('div'); d.className = 'r';
    const k = document.createElement('span');
    k.className = 'k'; k.textContent = label; k.title = title || label;
    d.appendChild(k); matPanelBody.appendChild(d); return d;
  };
  const head = mkRow2('construction', 'the skin material every section ' +
    'inherits its finish from (the "3b interior" construction row)');
  // DERIVED, not chosen: this row READS OUT the construction the sections
  // inherit from. The game's FINISH view shows the `intCons` row itself and
  // skips this one — two rows labelled `construction`, one of them dead, is
  // worse than either alone. The bench keeps it: there is no other row there
  // that says which AEROSKIN construction the intent resolved to.
  head.dataset.matHead = 'derived';
  const hv = document.createElement('span');
  hv.className = 'v'; hv.textContent = cons;
  head.appendChild(hv);
  // THE CONDITION DIAL (G70). One row, above the section list, because it is
  // a property of the AEROPLANE and not of any section — and because every
  // placement under it is derived, there is nothing else to expose.
  {
    const d = mkRow2('condition', 'how much this aeroplane has been flown: ' +
      'grime in the weave, chalked paint on the upper surfaces, dulled ' +
      'metal, and streaks from the exhaust and the wheels — all placed off ' +
      'the build itself');
    d.dataset.matHead = '1';
    const i = document.createElement('input');
    i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05;
    i.value = WEAR.amount; i.style.flex = '1';
    const v = document.createElement('span');
    v.className = 'v';
    // the words are the user's own: factory fresh -> flown -> weathered
    const say = x => x < 0.02 ? 'factory fresh'
               : x < 0.35 ? 'run in' : x < 0.7 ? 'flown' : 'weathered';
    v.textContent = say(+WEAR.amount);
    i.oninput = () => {
      WEAR.amount = +i.value; v.textContent = say(+i.value);
      aeroSavePrefs(); build();
    };
    d.appendChild(i); d.appendChild(v);
  }
  // ---- THE BASE COLOUR (G214, the user: "a macro base color in the plane
  // livery, that sets all the fuselage pieces to a single color, including
  // the rings, the pillars, the cowl, etc") -------------------------------
  // ONE pick writes every exterior cage section's tint (skin, rail and
  // pillar roles) and CLEARS the overrides on the layer parts that wear
  // their parent (the cowl, the struts, the fairings, the fittings), so they
  // follow the body from here. The per-section wells below still override
  // afterwards; the wing and the tail keep their own.
  {
    const d = mkRow2('base colour', 'one colour for the whole fuselage — ' +
      'the skin, the rings and pillars, the nose deck, the cowl, the ' +
      'struts, the fairings and the fittings, in one pick; the wells ' +
      'below still override a section afterwards');
    d.dataset.matHead = '1';
    const c = document.createElement('input');
    c.type = 'color'; c.style.flex = 'none';
    wellRecent(c);
    const cur = () => {
      const t = secTint.body != null ? secTint.body
        : A.AERO_FINISH[secFin.body || A.aeroFinishFor('body', cons)].base;
      return '#' + (t >>> 0).toString(16).padStart(6, '0');
    };
    c.value = cur();
    matPanelSync.push(() => { if (document.activeElement !== c) c.value = cur(); });
    c.oninput = () => {
      const v = parseInt(c.value.slice(1), 16);
      for (const nm of names)
        if (['skin', 'rail', 'pillar'].includes(A.AERO_ROLE[nm])) secTint[nm] = v;
      secTint.body = v;
      if (A.AERO_SEC) for (const k in A.AERO_SEC)
        if (A.AERO_SEC[k].wears === 'parent') delete secTint[k];
      aeroSavePrefs(); build();
    };
    d.appendChild(c);
    // G215: THE BASE PAINT'S METAL, the same reach as its colour — every
    // exterior cage section, and the layer parts that wear the parent
    const dm = mkRow2('base metallic', 'metal flake in the whole fuselage\'s ' +
      'paint — 0 plain, 1 all flake; the per-section rows still override');
    dm.dataset.matHead = '1';
    const im = document.createElement('input');
    im.type = 'range'; im.min = '0'; im.max = '1'; im.step = '0.02';
    im.value = String(secMetal.body != null ? secMetal.body : 0);
    im.style.flex = '1';
    const vm = document.createElement('span');
    vm.className = 'v'; vm.textContent = (+im.value).toFixed(2);
    im.oninput = () => {
      const x = +im.value; vm.textContent = x.toFixed(2);
      for (const nm of names)
        if (['skin', 'rail', 'pillar'].includes(A.AERO_ROLE[nm])) {
          if (x <= 0) delete secMetal[nm]; else secMetal[nm] = x;
        }
      if (x <= 0) delete secMetal.body; else secMetal.body = x;
      if (A.AERO_SEC) for (const k in A.AERO_SEC)
        if (A.AERO_SEC[k].wears === 'parent') delete secMetal[k];
      aeroSavePrefs(); build();
    };
    dm.appendChild(im); dm.appendChild(vm);
  }
  // ---- THE GLAZING, once for every pane (G113.2) -------------------------
  // The user asked for "a lot more options" on the glass and named most of
  // them. These are the CONDITION of the glazing — one windscreen and one
  // skylight on the same aeroplane are the same glass cut twice — while the
  // TINT stays per-pane, on the section rows below.
  //
  // WHAT r128 ACTUALLY ALLOWS decided the list. Transparency and reflection
  // are real material fields; the scratches, the wiper arc, the grime and the
  // rainbow are drawn analytically in AEROGLASS_HOOK, because this release's
  // MeshPhysicalMaterial has no `iridescence` and no `thickness` on this path
  // and a downloaded scratch map would be the only bitmap in a material
  // system whose every other sheet is baked at runtime.
  {
    const gr = (lab, key, lo, hi, step, title) => {
      const d = mkRow2(lab, title);
      // matHead '1' is "this row is the AEROPLANE'S, not a section's" —
      // the same tag the condition dial carries, and what G104's finish view
      // collects onto the root. A row with neither this nor a `data-sec`
      // belongs to no bucket and is silently dropped, which is exactly what
      // happened to the first cut of these.
      d.dataset.matHead = '1';
      // ...and `glaze` besides (2026-08-31, the user editing the windshield:
      // "I don't have any material options like alpha, reflectivity" — they
      // were on the ROOT only). The finish view uses this to bring the
      // shared dials along wherever a GLASS section's part is selected: one
      // set of rows, borrowed, never a second home.
      d.dataset.glaze = '1';
      const i = document.createElement('input');
      i.type = 'range'; i.min = lo; i.max = hi; i.step = step;
      i.value = GLASS[key]; i.style.flex = '1';
      const v = document.createElement('span');
      v.className = 'v'; v.textContent = (+GLASS[key]).toFixed(2);
      i.oninput = () => { GLASS[key] = +i.value;
        v.textContent = (+i.value).toFixed(2);
        aeroSavePrefs(); build(); };
      d.appendChild(i); d.appendChild(v);
    };
    gr('glazing: clarity', 'opacity', 0.05, 1, 0.01,
       'how much of the pane you see THROUGH — the view alpha still wins ' +
       'when it is asking for less, because that is a way of looking');
    gr('glazing: scratches', 'scratch', 0, 1, 0.02,
       'fine crazing in two crossed families, in real millimetres on the pane');
    gr('glazing: wiper arc', 'wipe', 0, 1, 0.02,
       'the swept band a wiper leaves — placed from a pivot, not tiled, ' +
       'which is what makes it an arc rather than curved texture');
    gr('glazing: edge grime', 'grime', 0, 1, 0.02,
       'dirt gathering toward the frame, measured from the PANE own extent ' +
       'so it does not move when the camera does');
    gr('glazing: reflections', 'refl', 0, 2, 0.05,
       'x the mood own environment strength, folded into the base so the ' +
       'two do not fight');
    gr('glazing: rainbow', 'rainbow', 0, 1, 0.02,
       'thin-film flare at the limb. An EFFECT, not physics: r128 has no ' +
       'iridescence and this is a Fresnel-driven hue rather than a film');
  }
  // ---- THE MATERIAL LAB (G206) --------------------------------------------
  // The user: "it would be good to have an editor to these parameters (right
  // now I can't access this layer)". ONE row element holding its own small
  // panel, so the finish view carries it as one block (data-lab) without
  // partitioning its innards. Everything in it writes the LIVE tables
  // through AEROSKIN's lab and never the spec — aeroskin.js, THE MATERIAL
  // LAB. The per-section dials below multiply whatever the lab says.
  if (A.aeroLabSet) {
    const d = mkRow2('material lab', 'the designer bench over the finish, ' +
      'construction and glazing tables — live, kept as deviations in this ' +
      'browser, exported as JSON to paste back into the table. Nothing ' +
      'here is saved with the aeroplane; the per-section dials multiply it');
    d.dataset.matHead = '1'; d.dataset.lab = '1';
    d.style.flexWrap = 'wrap'; d.style.alignItems = 'flex-start';
    const box = document.createElement('div');
    box.style.cssText =
      'flex:1 1 100%;display:flex;flex-direction:column;gap:2px;';
    d.appendChild(box);
    labRender(box);
  }
  for (const nm of names.concat(live)) {
    const isGlass = A.AERO_GLASS.has(nm);
    // a LAYER section's auto is the walked chain, not the role table: the
    // wing follows the fuselage's own choices before the construction
    const lay = A.AERO_SEC && A.AERO_SEC[nm] ? secResolveAuto(nm) : null;
    const derived = lay ? lay.fin : A.aeroFinishFor(nm, cons);
    const row = mkRow2(nm, isGlass ? 'glazing: its own family (transmission ' +
      '+ clearcoat), no finish to choose' : 'finish and colour for ' + nm);
    // WHICH SECTION THIS ROW IS ABOUT. The bench reads it off the label; the
    // game's FINISH view moves these rows under the PART that owns the
    // section, and a label is not something to partition a panel by.
    row.dataset.sec = nm;
    if (isGlass) {
      // A PANE TAKES A COLOUR LIKE ANYTHING ELSE (G113.2). It always could —
      // aeroGlass has had a `tint` argument since G67 — and the panel showed
      // the dead word "glass" instead, which is a read-out of a fact nobody
      // asked about. The CONDITION dials are shared and live once, at the
      // head of the glazing block below; the colour is this pane's own.
      glassWell(row, nm);
      continue;
    }
    const sfin = document.createElement('select');
    sfin.style.flex = '1';
    const o0 = document.createElement('option');
    // whose choice the auto is following: an ancestor section's override by
    // its declared label ('body' is the fuselage's own skin), else the
    // construction — the same word the cage rows always showed
    const follow = lay && lay.src
      ? 'follows ' + (lay.src === 'body' ? 'the fuselage'
          : ((A.AERO_SEC[lay.src] || {}).label || lay.src)) + ' — ' : '';
    o0.value = ''; o0.textContent = 'auto (' + follow + derived + ')';
    sfin.appendChild(o0);
    for (const k of Object.keys(A.AERO_FINISH)) {
      const o = document.createElement('option');
      o.value = k; o.textContent = A.AERO_FINISH[k].name;
      sfin.appendChild(o);
    }
    sfin.value = secFin[nm] || '';
    sfin.onchange = () => {
      if (sfin.value) secFin[nm] = sfin.value; else delete secFin[nm];
      aeroSavePrefs(); build();
    };
    row.appendChild(sfin);
    const col = document.createElement('input');
    col.type = 'color';
    wellRecent(col);                               // G156
    col.style.flex = 'none'; col.style.width = '30px';
    col.title = 'tint the albedo. The colour you pick is the colour you get ' +
      '(it is converted sRGB -> linear on the way to the shader)';
    // an UNSET well shows the colour the section actually wears: its own
    // tint, else the inherited one (a layer row following an ancestor),
    // else the finish's own base. Re-resolved in the closure so the sync
    // pass repaints wells whose ancestor's tint just moved.
    const wellV = () => {
      const r = A.AERO_SEC && A.AERO_SEC[nm] ? secResolve(nm) : null;
      const g0 = SEC_CTX[nm];
      return '#' + (secTint[nm] != null ? secTint[nm]
        : r && r.tint != null ? r.tint
        : (r && g0 && g0.tint0 != null) ? g0.tint0
        : A.AERO_FINISH[secFin[nm] || (r ? r.fin : derived)].base)
        .toString(16).padStart(6, '0');
    };
    col.value = wellV();
    matPanelSync.push(() => {
      if (document.activeElement !== col) col.value = wellV();
    });
    col.oninput = () => {
      secTint[nm] = parseInt(col.value.slice(1), 16);
      aeroSavePrefs(); build();
    };
    row.appendChild(col);
    // double-click the LABEL to drop the whole section back to its finish's
    // own numbers — the same per-row reset gesture G27 established for every
    // other row, now covering the dials below as well
    row.firstChild.style.cursor = 'pointer';
    row.firstChild.ondblclick = () => {
      delete secTint[nm]; delete secFin[nm];
      delete secTile[nm]; delete secRough[nm]; delete secNrm[nm];
      delete secWear[nm]; delete secCc[nm]; delete secField[nm];
      delete secMetal[nm];
      aeroSavePrefs(); build();
    };
    // G215: METALLIC, and it is not a multiplier — 0 is plain paint, 1 is
    // all flake — so it has its own row rather than a slot in the x-dials
    {
      const d = mkRow2('   metallic',
        'metal flake in the paint of ' + nm + ' — 0 plain, 1 all flake');
      d.className = 'r dial';
      d.dataset.sec = nm;
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.02';
      inp.value = String(secMetal[nm] != null ? secMetal[nm] : 0);
      const v = document.createElement('span');
      v.className = 'v';
      const show = () => { v.textContent = (+inp.value).toFixed(2); };
      show();
      inp.oninput = () => {
        show();
        const x = +inp.value;
        if (x <= 0) delete secMetal[nm]; else secMetal[nm] = x;
        aeroSavePrefs(); build();
      };
      d.appendChild(inp); d.appendChild(v);
    }
    // THE THREE DIALS, under the section they belong to. They MULTIPLY the
    // finish's own tile, roughness and normal strength, so 1.00 is the
    // material as designed — which is why they are x and not a value, and
    // why an untouched section stores nothing at all.
    for (const [key, store, label] of [['tile', secTile, 'tile x'],
                                       ['rough', secRough, 'roughness x'],
                                       ['nrm', secNrm, 'normal x'],
                                       // G206: the clear coat and the
                                       // large-scale field, as multipliers
                                       // of the finish's own numbers
                                       ['sheen', secCc, 'sheen x'],
                                       ['field', secField, 'field x'],
                                       // the part's own CONDITION (G114):
                                       // multiplies how much of the
                                       // aeroplane's one wear dial this
                                       // part shows — 0.25 the pampered
                                       // panel, 4 the one every hand opens
                                       ['wear rate', secWear, 'wear x']]) {
      const d = mkRow2('   ' + label,
        'multiplies the finish’s own ' + key + ' for ' + nm +
        ' — 1.00 is the material as it was designed');
      d.className = 'r dial';
      d.dataset.sec = nm;
      const inp = document.createElement('input');
      // G214: the floor came down 0.25 -> 0.05 (the user, dialling a
      // fabric wing: "all sliders need to go lower")
      inp.type = 'range'; inp.min = '0.05'; inp.max = '4'; inp.step = '0.05';
      inp.value = String(store[nm] != null ? store[nm] : 1);
      const v = document.createElement('span');
      v.className = 'v';
      const show = () => { v.textContent = (+inp.value).toFixed(2); };
      show();
      inp.oninput = () => {
        show();
        const x = +inp.value;
        if (Math.abs(x - 1) < 1e-6) delete store[nm]; else store[nm] = x;
        aeroSavePrefs(); build();
      };
      d.appendChild(inp); d.appendChild(v);
      d.firstChild.style.cursor = 'pointer';
      d.firstChild.ondblclick = () => {
        delete store[nm]; inp.value = '1'; show();
        aeroSavePrefs(); build();
      };
    }
  }
  // THE SECTION LIST JUST CHANGED SHAPE. Everything above is rebuilt DOM, and
  // the game's FINISH view is holding the old nodes in its own column — it has
  // to be told, or it shows the finish of an aeroplane that no longer exists.
  // Announced only on a real rebuild: the signature check above returns early
  // on every other build, which is nearly all of them.
  if (window.CAGE_ON_MAT) try { window.CAGE_ON_MAT(); } catch (e) {
    console.error('finish view:', e); }
}

function syncSliders() {
  for (const meta of ROWMETA) {
    const { k, kind, names, opts } = meta;
    const el = meta.el;
    if (!el) continue;
    const v = k === 'planeScale' ? relSize() : P[k];
    if (v == null) continue;
    if (kind === 'check') {
      el.checked = +v >= 1;
      if (meta.vs && names) meta.vs.textContent = names[el.checked ? 1 : 0];
    } else if (kind === 'select') el.value = String(+v);
    else if (kind === 'step') el.value = String(+v);
    else {
      el.value = v;
      if (meta.vf) meta.vf.value = fmtV(+v);
    }
    if (meta.linkEl) {
      const t = (opts.link && opts.link.test) ||
        (x => x === opts.link.sentinel);
      let on = false;
      try { on = !!t(P[k]); } catch (e) {}
      meta.linkEl.checked = on;
      // while linked the number is the layer's to resolve — hide the widget
      const vis = on ? 'none' : '';
      el.style.display = vis;
      if (meta.vf) meta.vf.style.display = vis;
      if (meta.mu) meta.mu.style.display = vis;
    }
  }
  applyRowVis();
}
function applyPreset(name) {
  if (name.startsWith('* ')) {
    const cfg = savedCfgs()[name.slice(2)];
    if (cfg) Object.assign(P, cfg.P);      // cfg.M (old macros) is ignored
  } else {
    const pre = (PAGE.presets || {})[name] || {};
    // WHERE THE ROW STARTS FROM. Default is this page's own aeroplane, which
    // is what a preset written AGAINST it means. A row imported from a saved
    // build means something else: `spec.cage` is deviations from the
    // TEMPLATE, so laying one over the page defaults leaks every key the
    // export does not mention. `_base: 'template'` says so; see the piper
    // cub row in _cage_page5.js.
    const base = pre._base === 'template' ? G.CAGE_PARAMS : DEFAULTS;
    for (const k in base) P[k] = base[k];
    for (const k in pre) if (k !== '_base') P[k] = pre[k];
  }
  loaded();
  anchorSize();                            // this design is now ×1
  syncSliders(); build();
}
$('resetBtn').onclick = () => {
  for (const k in DEFAULTS) P[k] = DEFAULTS[k];
  loaded();
  anchorSize();
  syncSliders(); build();
};
$('objBtn').onclick = () => {
  const step = $('step') ? $('step').value : 'crease';
  const lines = ['# cage export, step ' + step, 'o cage_' + step];
  for (const v of M0.V)
    lines.push('v ' + v.map(c => c.toFixed(6)).join(' '));
  const byMat = {};
  M0.F.forEach(f => { (byMat[f.m] = byMat[f.m] || []).push(f.v); });
  for (const m in byMat) {
    lines.push('usemtl ' + m);
    for (const f of byMat[m]) lines.push('f ' + f.map(i => i + 1).join(' '));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'],
    { type: 'text/plain' }));
  a.download = 'cage_' + step + '.obj';
  a.click();
};
for (const id of ['lvl', 'cage', 'curv', 'surf', 'mat'])
  if ($(id)) $(id).onchange = build;
for (const id of ['wire', 'color'])
  if ($(id)) $(id).onchange = () => {
    // material flags only — rebuild materials, keep geometry
    if (meshObj && meshObj.material && meshObj.material.map) {}
    build();
  };
if ($('step')) $('step').onchange = () => { loadRef(); build(); };
if ($('refOn')) $('refOn').onchange = loadRef;
if ($('refA')) $('refA').oninput = loadRef;
const viewEl = EXT ? null : $('view');
// left drag = orbit; MIDDLE or RIGHT drag = PAN (user ask) — the pan
// moves the look-at centre in the camera's screen plane, scaled to the
// world size per pixel at the target distance; dblclick refits both.
// EXT has no viewport of its own — the game canvas and its controls are
// the viewport — so the whole wiring block is skipped.
let panD = null;
if (viewEl) {
viewEl.addEventListener('mousedown', e => {
  if (e.button === 1 || e.button === 2) {
    panD = [e.clientX, e.clientY, (centreOv || centre).clone()];
    e.preventDefault();
  } else drag = [e.clientX, e.clientY, yaw, pitch];
});
viewEl.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', () => { drag = null; panD = null; });
addEventListener('mousemove', e => {
  if (panD) {
    const r = cv.getBoundingClientRect();
    const wpp = 2 * (fitR / ZOOM) *
      Math.tan(camera.fov * Math.PI / 360) / Math.max(1, r.height);
    const e0 = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const e1 = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    centreOv = panD[2].clone()
      .addScaledVector(e0, -(e.clientX - panD[0]) * wpp)
      .addScaledVector(e1, (e.clientY - panD[1]) * wpp);
    draw();
    return;
  }
  if (!drag) return;
  yaw = drag[2] + (e.clientX - drag[0]) * 0.008;
  pitch = Math.max(-1.35, Math.min(1.35, drag[3] + (e.clientY - drag[1]) * 0.006));
  draw(); });
viewEl.addEventListener('wheel', e => {
  e.preventDefault();
  ZOOM = Math.max(0.2, Math.min(15, ZOOM * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  draw();
}, { passive: false });
viewEl.addEventListener('dblclick', () => {
  ZOOM = 1; centreOv = null; draw();
});
addEventListener('resize', () => MS && draw());
// the side pane is resizable (CSS resize on the aside) — the canvas must
// follow the #view box live, not only on window resize
if (typeof ResizeObserver !== 'undefined')
  new ResizeObserver(() => MS && draw()).observe(viewEl);
}

if (PAGE.defaultStep && $('step')) $('step').value = PAGE.defaultStep;
anchorSize();                              // the page opens at its ×1
syncSliders();
window.CAGE_UI = { P, build, draw, applyPreset, syncSliders,
  // THE TWO HALVES OF A LOAD (G63). `applySpec` puts a build into the editor;
  // `toSpec` takes the editor's whole parameter set out as the spec's `cage`
  // fragment — layer keys included, view keys excluded. Every shelf load,
  // every import and the game's own openEditor go through these, so there is
  // one route in and one route out instead of a preset menu standing in for
  // the load path that never existed.
  applySpec, toSpec: () => G.cageToSpec(P),
  setView: (y, p, z, c) => { yaw = y; pitch = p; if (z) ZOOM = z;
    centreOv = c ? new THREE.Vector3(c[0], c[1], c[2]) : null; },
  get M0() { return M0; }, get MS() { return MS; },
  // ---- WHAT THE GAME'S EDITOR READS (G77) --------------------------------
  // The panel above is the BENCH's. The game builds its own two-column screen
  // over the same rows — it MOVES these DOM nodes rather than rebuilding
  // them, so every behaviour they carry (the typed value, the clamp, the
  // double-click reset, the `link` checkbox, the `= front` button, the ≈ m
  // readout, the `when` hiding) is the same code in both places and cannot
  // drift. Everything below is a handle on state this file already keeps.
  ROWMETA, GROUPMETA, SEC, DEFAULTS, EXPERT, applyRowVis,
  // the materials panel's own two bodies, for the same reason: the FINISH view
  // moves these rows rather than building a second set of colour pickers.
  get MATBODY() { return matPanelBody; },
  get DECBODY() { return decPanel ? decPanel.lastChild : null; },
  // the design the per-row and per-part resets go back to. It re-anchors on
  // every whole-set load (preset, import, reset, boot) — see anchorSize.
  get BASELINE() { return BASELINE; },
  // one route for writing a parameter from outside, so a reset and a slider
  // drag take the same path in
  setParam: (k, v) => { P[k] = v; },
  // THE FINISH, in and out of the spec (G105). `applySpec` already calls the
  // second one; the first is what `_cage_join.js`'s export puts on the build.
  finishToSpec, finishFromSpec,
  // THE IMAGE PAGES (G190): out as {page: dataURL, aspect} for the save
  // envelope, in from one — the pixels a spec deliberately does not carry
  // G208: the certification stickers ride the decal list through aeroskin's
  // AERO_EXTRA_DECALS hook; when a certificate is awarded or withdrawn the
  // bench asks for the list to be rebuilt, which is this call
  redecal: () => { try { applyDecals(); draw(); } catch (e) {} },
  decalImages, decalImagesFrom };
// THE ROWS EXIST NOW, and the game's editor can take them. It runs BEFORE the
// first build(): the panel it builds is what the build's own applyRowVis pass
// then decides the visibility of, and doing it the other way round would show
// one frame of every row at once.
if (window.CAGE_ON_ROWS) try { window.CAGE_ON_ROWS(); } catch (e) {
  console.error('editor panel:', e); }
build();
}
window.CAGE_UI_BOOT = CAGE_UI_BOOT;
if (!window.CAGE_UI_LAZY) CAGE_UI_BOOT();
