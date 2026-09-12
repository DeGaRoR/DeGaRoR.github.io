// THE INSTRUMENT PANEL LAYER — the panel arc (futureDesigns/PANEL-2026-09-11.md).
//
// SESSION 2 (2026-09-11): THE FIT AS A LIST. This file owns `spec.systems`
// the way _cage_energy.js owns `spec.energy`: a view of the section, a
// column the part tree opens (`_cage_parts.js` names this global as the
// Instruments part's `panel`), the commit through GARAGE_SPEC, and the join's
// seam (`toSpec`). The core's ONE reader, genSystemsResolve (60_gen_spec.js),
// answers what the fit actually is — the tier, the player's edits, what the
// electrics can feed — and the bill it adds up to; this column shows that
// answer and never computes a second one.
//
// SESSION 3 (2026-09-11) gave this layer its geometry (below): the dials,
// the drums, the switches and the key as `edGauge_*` moving groups on the
// dash face, the painted faces on one atlas, the material factory.
// _cage_crew.js's buildPanel stays as the headless fallback.
//
// Load order: after _cage_crew.js (build.js MANIFEST.editor, _cage8.html,
// _parts_check.js — the three lists). Node-loadable with no document (GATE
// PARTS): nothing here touches the DOM at load, and the state is seeded
// lazily by whoever asks first (the crew's post runs before ours).
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const HAS_DOM = typeof document !== 'undefined';
const inGame = () => !!window.CAGE_IN_GAME;
const cl = o => JSON.parse(JSON.stringify(o));
const core = () => ({
  INSTR: typeof GEN_INSTR !== 'undefined' ? GEN_INSTR : null,
  ELEC: typeof GEN_ELEC !== 'undefined' ? GEN_ELEC : null,
  AV: typeof GEN_AVIONICS !== 'undefined' ? GEN_AVIONICS : null,
  TIERS: typeof GEN_SYSTEMS !== 'undefined' ? GEN_SYSTEMS : null,
  UNITS: typeof GEN_SYSTEMS_UNITS !== 'undefined' ? GEN_SYSTEMS_UNITS : { aviation: 'kt / ft / fpm', metric: 'km/h / m / m/s' },
  SIDES: typeof GEN_SYSTEMS_SIDES !== 'undefined' ? GEN_SYSTEMS_SIDES : ['pilot', 'centre'],
  resolve: typeof genSystemsResolve === 'function' ? genSystemsResolve : null,
});

// ---------------------------------------------------------------------------
// THE STATE — a view of spec.systems. Nulls are DERIVED (the tier's answer),
// exactly the spec's own contract; a list is the player's.
// ---------------------------------------------------------------------------
const SY = { fit: 'basic', units: 'aviation', items: null,
             elec: { battery: null, alternator: null, starter: null, vac: null },
             avionics: { com: null, xpdr: null, nav: null, gps: null },
             side: 'pilot' };
let seeded = false;

function fromSpec(sy) {
  const s = (sy && typeof sy === 'object') ? sy : {};
  SY.fit = typeof s.fit === 'string' ? s.fit : 'basic';
  SY.units = typeof s.units === 'string' ? s.units : 'aviation';
  SY.side = typeof s.side === 'string' ? s.side : 'pilot';
  SY.items = Array.isArray(s.items) ? s.items.slice() : null;
  for (const k of Object.keys(SY.elec))
    SY.elec[k] = (s.elec && s.elec[k] != null) ? s.elec[k] : null;
  for (const k of Object.keys(SY.avionics))
    SY.avionics[k] = (s.avionics && s.avionics[k] != null) ? s.avionics[k] : null;
  seeded = true;
  if (panelBody) renderPanel();
}
function toSpec() {
  if (!seeded) seed();
  return cl(SY);
}
// the resolved fit, as the core answers it — tier, items, electrics, radios,
// the bill, what was dropped and why
function resolve() {
  if (!seeded) seed();
  const C = core();
  if (!C.resolve) return null;
  const S = (inGame() && window.GARAGE_SPEC && window.GARAGE_SPEC.get)
    ? Object.assign({}, window.GARAGE_SPEC.get(), { systems: cl(SY) })
    : { systems: cl(SY) };
  return C.resolve(S);
}

// the bench remembers its fit across reloads, as the energy panel does; the
// game seeds from the spec and never from this
const LSKEY = () => 'cagePanel:' + (typeof location !== 'undefined' ? location.pathname : '');
function loadPrefs() {
  if (inGame() || typeof localStorage === 'undefined') return false;
  try {
    const j = JSON.parse(localStorage.getItem(LSKEY()) || 'null');
    if (j && typeof j === 'object' && typeof j.fit === 'string') { fromSpec(j); return true; }
  } catch (e) {}
  return false;
}
function savePrefs() {
  if (inGame() || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(LSKEY(), JSON.stringify(toSpecRaw())); } catch (e) {}
}
const toSpecRaw = () => cl(SY);
function seed() {
  if (seeded) return;
  if (inGame() && window.GARAGE_SPEC && window.GARAGE_SPEC.get) {
    try { fromSpec(window.GARAGE_SPEC.get().systems); } catch (e) {}
  }
  if (!seeded && !loadPrefs()) fromSpec(null);
}

// ---------------------------------------------------------------------------
// COMMIT — the spec is the owner
// ---------------------------------------------------------------------------
function commit() {
  savePrefs();
  if (!inGame()) {                       // the bench: redraw the dash's dials
    if (window.CAGE_UI && window.CAGE_UI.build) try { window.CAGE_UI.build(); } catch (e) {}
    return;
  }
  const G = window.GARAGE_SPEC;
  if (!G || !G.update) return;
  // one door: update merges `systems` (objects deep, the list whole, a null
  // written on purpose survives) and puts the aeroplane back on the stand
  try { G.update({ systems: toSpecRaw() }); } catch (e) { console.error('instruments:', e); }
  // THE DASH REDRAWS ITS DIALS (the crew layer draws the resolved list
  // during the editor's build, not on a spec update — the tanks relayout
  // themselves, a dial is part of the cage's own post chain)
  if (window.CAGE_UI && window.CAGE_UI.build) try { window.CAGE_UI.build(); } catch (e) {}
}
// an edit to the list, the electrics or the radios makes the fit CUSTOM with
// every field explicit — the tier is a preset, not a live rule; a tier pick
// puts everything back to derived
function makeCustom() {
  if (SY.fit === 'custom' && SY.items) return;
  const r = resolve();
  SY.fit = 'custom';
  if (r) {
    if (!SY.items) SY.items = r.items.slice();
    for (const k of Object.keys(SY.elec)) if (SY.elec[k] == null) SY.elec[k] = r.elec[k];
    for (const k of Object.keys(SY.avionics)) if (SY.avionics[k] == null) SY.avionics[k] = r.avionics[k];
  }
}
function pickTier(t) {
  SY.fit = t;
  if (t !== 'custom') {
    SY.items = null;
    for (const k of Object.keys(SY.elec)) SY.elec[k] = null;
    for (const k of Object.keys(SY.avionics)) SY.avionics[k] = null;
  } else makeCustom();
}

// ---------------------------------------------------------------------------
// THE COLUMN
// ---------------------------------------------------------------------------
let panel = null, panelBody = null, panelWrap = null;
const el = (tag, cls, txt) => {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (txt != null) d.textContent = txt;
  return d;
};
function row(parent, label, title) {
  const d = el('div', 'r');
  const k = el('span', 'k', label); k.title = title || label;
  d.appendChild(k); parent.appendChild(d);
  return d;
}
function select(parent, label, title, options, value, onchange) {
  const d = row(parent, label, title);
  const s = document.createElement('select'); s.style.flex = '1';
  for (const [v, name] of options) {
    const o = document.createElement('option');
    o.value = v; o.textContent = name;
    if (v === String(value)) o.selected = true;
    s.appendChild(o);
  }
  s.onchange = () => onchange(s.value);
  d.appendChild(s);
  return s;
}
function fold(parent, name, open) {
  const det = document.createElement('details');
  det.open = !!open;
  det.style.marginLeft = '6px';
  const sum = document.createElement('summary');
  sum.textContent = name;
  det.appendChild(sum);
  parent.appendChild(det);
  return det;
}
function mountPanel() {
  if (panel || !HAS_DOM) return;
  const ui = document.getElementById('cgUi') || document.getElementById('ui');
  if (!ui) return;
  panel = document.createElement('details');
  panel.dataset.g = 'instruments';
  panel.open = true;
  panel.innerHTML = '<summary>instruments</summary>';
  panelBody = document.createElement('div');
  panel.appendChild(panelBody);
  const en = ui.querySelector('details[data-g="energy"]');
  if (en && en.nextSibling) ui.insertBefore(panel, en.nextSibling); else ui.appendChild(panel);
}
// the part tree's door (editor.js asks for the element and appends it —
// the energy panel's shape, G183)
function panelElement() {
  if (!HAS_DOM) return null;
  if (!panel) mountPanel();
  if (panel && panelBody && !panelBody.firstChild) renderPanel();
  if (panel) {
    const s = panel.querySelector(':scope > summary');
    if (s) { s.style.display = 'none'; panel.open = true; }
  }
  if (panel && !panelWrap) {
    panelWrap = document.createElement('div');
    panelWrap.className = 'edRoot';
  }
  if (panelWrap && panel && panel.parentNode !== panelWrap) panelWrap.appendChild(panel);
  return panelWrap;
}
const fmtKg = x => (x >= 10 ? x.toFixed(1) : x.toFixed(2)) + ' kg';
const fmtCr = x => Math.round(x).toLocaleString('en') + ' cr';

function renderPanel() {
  if (!panelBody) return;
  if (!seeded) seed();
  const C = core(), B = panelBody;
  B.innerHTML = '';
  if (!C.INSTR || !C.TIERS || !C.resolve) {
    B.appendChild(el('div', 'r', 'the core (flight_core.js) is not loaded — no catalogue'));
    return;
  }
  const R = resolve();

  // ---- the tier, the units, the side --------------------------------------
  select(B, 'fit', 'a tier presets the list, the electrics and the radios; ' +
    'any edit below makes it custom',
    Object.keys(C.TIERS).map(k => [k, C.TIERS[k].name]), R.tier,
    v => { pickTier(v); renderPanel(); commit(); });
  select(B, 'units', 'what the dial faces are painted in (per build)',
    Object.keys(C.UNITS).map(k => [k, C.UNITS[k]]), R.units,
    v => { SY.units = v; renderPanel(); commit(); });
  select(B, 'side', 'which side of the dash the flight instruments are built in front of',
    C.SIDES.map(k => [k, k]), R.side,
    v => { SY.side = v; renderPanel(); commit(); });

  // ---- the dials -----------------------------------------------------------
  const dials = fold(B, 'dials · ' + R.items.length + ' fitted', true);
  const fitted = new Set(R.items);
  const wanted = new Set(SY.items || (C.TIERS[R.tier].items || C.TIERS.basic.items));
  const dropped = {};
  for (const d of R.dropped) dropped[d.key] = d.why;
  for (const k of Object.keys(C.INSTR)) {
    const r = C.INSTR[k];
    const d = row(dials, r.name, (r.note || '') + (r.power !== 'none' ? ' · needs ' +
      (r.power === 'elec' ? 'a battery' : 'suction') : ''));
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = wanted.has(k);
    cb.onchange = () => {
      makeCustom();
      const set = new Set(SY.items || []);
      if (cb.checked) set.add(k); else set.delete(k);
      SY.items = Object.keys(C.INSTR).filter(q => set.has(q));
      renderPanel(); commit();
    };
    d.appendChild(cb);
    const v = el('span', 'v', dropped[k] ? 'dead — ' + dropped[k]
      : (fitted.has(k) ? fmtCr(r.price) + ' · ' + fmtKg(r.kg) : ''));
    if (dropped[k]) v.style.color = '#e08a5a';
    d.appendChild(v);
  }

  // ---- the electrics --------------------------------------------------------
  const elec = fold(B, 'electrics' + (R.hasBus ? '' : ' · none (hand-propped)'), true);
  const elecLabel = { battery: 'battery', alternator: 'charging', starter: 'starter', vac: 'suction' };
  for (const k of Object.keys(C.ELEC)) {
    if (k === 'harness') continue;
    const tab = C.ELEC[k];
    select(elec, elecLabel[k] || k, Object.keys(tab).map(q => tab[q].note ? q + ': ' + tab[q].note : q).join('\n'),
      Object.keys(tab).map(q => [q, tab[q].name + (tab[q].kg ? ' · ' + fmtKg(tab[q].kg) + ' · ' + fmtCr(tab[q].price) : '')]),
      R.elec[k], v => { makeCustom(); SY.elec[k] = v; renderPanel(); commit(); });
  }

  // ---- the radios -------------------------------------------------------------
  const av = fold(B, 'radios', true);
  const avLabel = { com: 'COM', xpdr: 'transponder', nav: 'NAV', gps: 'GPS' };
  for (const k of Object.keys(C.AV)) {
    const tab = C.AV[k];
    select(av, avLabel[k] || k, Object.keys(tab).map(q => tab[q].note ? q + ': ' + tab[q].note : q).join('\n'),
      Object.keys(tab).map(q => [q, tab[q].name + (tab[q].kg ? ' · ' + fmtKg(tab[q].kg) + ' · ' + fmtCr(tab[q].price) : '') +
        (tab[q].later ? ' — declared, not drawn yet' : '')]),
      R.avionics[k], v => { makeCustom(); SY.avionics[k] = v; renderPanel(); commit(); });
  }

  // ---- the bill ----------------------------------------------------------------
  const bill = fold(B, 'the bill · ' + fmtKg(R.kg) + ' · ' + fmtCr(R.price), false);
  const groups = [['panel', 'instruments'], ['elec', 'electrics'], ['avionics', 'radios']];
  for (const [g, name] of groups) {
    const rows = R.rows.filter(r => r.group === g);
    if (!rows.length) continue;
    const sum = R.bill[g];
    const h = row(bill, name, '');
    h.appendChild(el('span', 'v', fmtKg(sum.kg) + ' · ' + fmtCr(sum.price)));
    for (const r of rows) {
      const d = row(bill, '   ' + r.name, r.key);
      d.appendChild(el('span', 'v', fmtKg(r.kg) + ' · ' + fmtCr(r.price)));
    }
  }
  if (R.dropped.length) {
    const d = row(bill, 'not fitted', 'items this build cannot feed — they bill nothing');
    d.appendChild(el('span', 'v', R.dropped.map(x => (C.INSTR[x.key] ? C.INSTR[x.key].name : x.key) +
      ' (' + x.why + ')').join(', ')));
  }
  if (R.loads.length) {
    const amps = R.loads.reduce((a, l) => a + l.amps, 0);
    const d = row(bill, 'bus load', 'the continuous draw of everything fitted, at 12 V');
    d.appendChild(el('span', 'v', amps.toFixed(1) + ' A' +
      (R.altA ? ' of ' + R.altA + ' A' : '') + (R.battAh ? ' · ' + R.battAh + ' Ah' : '')));
  }
}

// ---------------------------------------------------------------------------
// THE HOOKS
// ---------------------------------------------------------------------------
const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  if (!seeded) seed();
  if (HAS_DOM && !inGame()) { mountPanel(); if (panelBody) renderPanel(); }
  if (ctx && ctx.stat) {
    const R = resolve();
    if (R) ctx.stat.textContent += '  ·  fit: ' + R.tier + ', ' + R.items.length + ' dials' +
      (R.dropped.length ? ', ' + R.dropped.length + ' dead' : '');
  }
};
// a preset or a reset on the bench is a new aeroplane: it gets the file's fit
const prevLoad = PAGE.load;
PAGE.load = spec => {
  if (prevLoad) try { prevLoad(spec); } catch (e) {}
  if (!inGame()) fromSpec(spec && spec.systems);
};

// ===========================================================================
// SESSION 3 — THE GEOMETRY: the dials on the dash face, the switch row, the
// painted faces. Built INTO the crew layer's group (the crew calls `build`
// where its own buildPanel used to run, with the anchors it measured), so
// the crew's disposal covers it and a click lands in the crew's layer with
// an `edGauge_*` name the editor maps to the Instruments part.
//
// EVERY MOVING PIECE IS A NAMED GROUP on the crew's `movingAt` contract:
// `edGauge_<key>_<hand>` with {pivot, axis, drive, sgn, k, law, ...} in
// CAGE_PANEL.moving — the join lifts them by name (session 4), app.js turns
// them by the laws _panel_gen publishes. Pivots and axes are in the CAGE
// frame here; the join walks them into the model's.
//
// THE FACES ARE ONE ATLAS (PANEL_GEN.paintAtlas → a CanvasTexture) on ONE
// material, `CAGE_PANEL.material('faces')`, emissive over the same map so
// the instrument light (LIGHTS.instr, the `li_instr` dimmer) backlights the
// printing and nothing else. Never repainted per frame: the attitude ball
// and the compass card are GEOMETRY that turns. `userData.panelSet` is the
// join's bucket key (a face quad must never merge into a colour bucket, or
// its uv is lost — the G182 rule, fourth time).
// ===========================================================================
const PG = () => window.PANEL_GEN;
const KIT = () => window.GEAR_KIT;
// THE LAYER'S MATERIAL TABLE, declared like every layer's so GATE SKINMAT
// can check it against AERO_HARD.panel in both directions. `face` is null
// there: it is the atlas material, not a finish.
const MAT = {
  bezel:  { col: 0x2a2d33, rough: 0.55, metal: 0.10 },   // the painted clamp ring
  needle: { col: 0xe8e4d8, rough: 0.60, metal: 0.00 },   // painted alloy
  hub:    { col: 0x1c1e22, rough: 0.50, metal: 0.30 },
  symbol: { col: 0xf0a030, rough: 0.55, metal: 0.00 },   // the AI / TC aeroplane
  ball:   { col: 0x101214, rough: 0.30, metal: 0.00 },   // the inclinometer ball
  plate:  { col: 0x2b2e34, rough: 0.70, metal: 0.10 },   // the switch row's base
  lever:  { col: 0xb8bcc2, rough: 0.35, metal: 0.80 },   // a toggle's bat
  knob:   { col: 0x24262b, rough: 0.55, metal: 0.00 },   // a dimmer's knob
  rocker: { col: 0xe9e5dc, rough: 0.60, metal: 0.00 },   // a master rocker
  key:    { col: 0xc9b47a, rough: 0.35, metal: 0.85 },   // brass
  barrel: { col: 0x8d949c, rough: 0.40, metal: 0.70 },   // the lock barrel
  bowl:   { col: 0x2a2d33, rough: 0.35, metal: 0.10 },   // the compass bowl
  face:   { col: 0x101214, rough: 0.85, metal: 0.00 },   // the atlas (no finish)
};
const matCache = {};
function matFor(name) {
  if (matCache[name]) return matCache[name];
  const A = window.AEROSKIN;
  let m = null;
  if (name !== 'face' && A && A.aeroHardMat)
    m = A.aeroHardMat(THREE, 'panel', name, MAT[name].col, { side: THREE.FrontSide, inside: 1 });
  if (!m) m = new THREE.MeshStandardMaterial({ color: MAT[name].col, roughness: MAT[name].rough,
                                               metalness: MAT[name].metal, side: THREE.FrontSide });
  return (matCache[name] = m);
}
// THE ATLAS AND ITS MATERIAL. One canvas, painted once per (fit, units,
// scale) signature; the texture is uploaded on `needsUpdate` only then.
let atlasCv = null, atlasTex = null, atlasSig = null, facesMat = null;
function atlas() {
  if (!atlasCv) {
    atlasCv = document.createElement('canvas');
    atlasCv.width = PG().ATLAS_W; atlasCv.height = PG().ATLAS_H;
  }
  return atlasCv;
}
function facesMaterial() {
  if (facesMat) return facesMat;
  const cv = atlas();
  atlasTex = new THREE.CanvasTexture(cv);
  atlasTex.encoding = THREE.sRGBEncoding;
  atlasTex.anisotropy = 8;
  atlasTex.flipY = true;
  facesMat = new THREE.MeshStandardMaterial({
    map: atlasTex, color: 0xffffff, roughness: 0.85, metalness: 0,
    emissive: new THREE.Color(0xffb060), emissiveMap: atlasTex, emissiveIntensity: 0,
    side: THREE.FrontSide });
  facesMat.userData.aeroskin = 1;          // never the grey understudy
  facesMat.userData.panelSet = 'faces';    // the join's bucket key
  facesMat.userData.inside = 1;
  return facesMat;
}
// the backlight: the instrument dimmer, through the light master
function faceDim(P) {
  if (!P || !+P.lightOn) return 0;
  const v = +P.li_instr;
  return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}
// the aeroplane's own numbers for the scales: the plaque when the game has
// one, the spec's rated engine otherwise; nothing invented
function scaleFacts(P) {
  const o = {};
  try {
    const G = window.GARAGE_SPEC;
    const pl = G && G.plaque ? G.plaque() : null;
    if (pl) {
      if (pl.Vs > 0) o.Vs1 = pl.Vs;
      if (pl.VsFlap > 0) o.Vs0 = pl.VsFlap; else if (pl.Vs > 0) o.Vs0 = pl.Vs;
      if (pl.VCruise > 0) o.Vh = pl.Vh > 0 ? pl.Vh : pl.VCruise * 1.12;
    }
    const S = G ? (G.resolved ? G.resolved() : (G.get ? G.get() : null)) : null;
    const E = S && ((S.pplant && S.pplant.engine) || (typeof POWERPLANTS !== 'undefined' &&
                S.engines && S.engines[0] && POWERPLANTS[S.engines[0].type] && POWERPLANTS[S.engines[0].type].engine));
    if (E && E.rpm > 0) o.rpm = E.rpm;
    else if (S && S.engines && S.engines[0] && S.engines[0].custom && S.engines[0].custom.rpm > 0) o.rpm = S.engines[0].custom.rpm;
  } catch (e) {}
  // the declared limits (GEN_RULES when it carries them, the study's rules
  // otherwise): Vfe = 1.8 Vs0, Vne = 1.25 Vh — printed DERIVED on the card
  const R = (typeof GEN_RULES !== 'undefined') ? GEN_RULES : {};
  if (o.Vs0) o.Vfe = (R.flapVfeK || 1.8) * o.Vs0;
  if (o.Vh) o.Vne = (R.vneK || 1.25) * o.Vh;
  return o;
}
// a uv-carrying bag: the faces and the drums (GEAR_KIT's Bag has no uv)
function UVBag(mat) {
  const pos = [], uv = [], idx = [];
  return {
    v: (p, t) => { pos.push(p[0], p[1], p[2]); uv.push(t[0], t[1]); return pos.length / 3 - 1; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    mesh: (parent, name) => {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      if (name) m.name = name;
      parent.add(m);
      return m;
    },
  };
}
// the moving-group contract (the crew's movingAt, kept here so this layer
// stays node-loadable without the crew's closure)
let MOVING = [];
function gaugeAt(parent, name, pivot, axis, drive, law, x2) {
  let nm = name, i = 1;
  while (MOVING.some(m => m.name === nm)) nm = name + '#' + (++i);
  const g = new THREE.Group();
  g.position.set(pivot[0], pivot[1], pivot[2]);
  g.name = nm;
  parent.add(g);
  MOVING.push(Object.assign({ name: nm, pivot, axis, drive, sgn: 1, k: 1, law }, x2 || {}));
  return g;
}
// clock angle (deg, clockwise for the pilot) → a rotation about the cage
// +z axis. The pilot looks along +z at a face whose 12 is +y and whose
// 3 o'clock is −x (cage +x is port); a positive turn about +z carries +y
// toward −x, so clockwise IS positive about +z — no sign to remember.
const clockRad = deg => deg * Math.PI / 180;

// ---- the pieces ------------------------------------------------------------
// the bezel: a clamp ring proud of the face with a chamfered lip, revolved
// about the dial's own axis (+z, into the dash)
function bezelAt(bag, cx, cy, z, r, skirt) {
  KIT().revolve(bag, [cx, cy, z], [0, 0, 1],
    [[r * 0.86, -0.008], [r * 0.93, -0.009], [r, -0.006], [r, 0.012 + (skirt || 0)], [r * 0.86, 0.012 + (skirt || 0)]], 40, false);
}
// the face: a disc of quads carrying the atlas slot, at z (normal −z)
function faceAt(bag, cx, cy, z, r, slot, seg) {
  const G = PG(), d = 2 * r * 1.0;
  const c = bag.v([cx, cy, z], G.faceUV(slot, cx, cy, cx, cy, d));
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    ring.push(bag.v([x, y, z], G.faceUV(slot, x, y, cx, cy, d)));
  }
  for (let i = 0; i < seg; i++) bag.tri(c, ring[(i + 1) % seg], ring[i]);
}
// a needle: a tapered blade from the hub to L, a counterweight tail, drawn
// pointing at 12 o'clock (+y) in its own group; the group's rotation is the
// reading. `thick` proud of the pivot toward the pilot (−z).
function needleInto(bag, H, r, thick) {
  const L = H.L * r, w = H.w * r, t = (H.tail || 0) * r, z = -thick;
  const a = bag.v([-w, -t, z]), b = bag.v([w, -t, z]);
  const c = bag.v([w * 0.35, L, z]), d = bag.v([-w * 0.35, L, z]);
  bag.quad(a, b, c, d);
  // a little depth so it reads as a blade, not a decal
  const z2 = z + 0.0012;
  const a2 = bag.v([-w, -t, z2]), b2 = bag.v([w, -t, z2]);
  const c2 = bag.v([w * 0.35, L, z2]), d2 = bag.v([-w * 0.35, L, z2]);
  bag.quad(d2, c2, b2, a2);
  bag.quad(a, d, d2, a2); bag.quad(b, b2, c2, c); bag.quad(d, c, c2, d2); bag.quad(a, a2, b2, b);
}
function hubAt(bag, cx, cy, z, r) {
  KIT().revolve(bag, [cx, cy, z], [0, 0, 1], [[r, -0.0035], [r, 0.002], [r * 0.2, 0.002]], 16, true);
}
// THE CAN (session 4b, the user: "stick them in well so they don't poke
// back"): every instrument is a closed cylinder BEHIND the plate, from the
// bezel's back to its own depth, so nothing of a hand's hub, a drum or a
// card shows from any side but the face — the plate is recessed and the
// dash is a box 0.35 m deep, so the can lives inside it.
const AI_DRUM_K = 1.2;             // the drum's radius over the bezel's
const AI_WINDOW = 0.58;            // the face ring's hole, over the bezel's radius
const AI_PROUD = 0.007;            // the drum's front, proud of the plate: its plane cuts the drum at 0.62 r, outside the window
const AI_STAND = 0.008;            // the AI's bezel and ring stand this much further out than the others' — the ring is then in front of every part of the drum outside the window
function canAt(bag, cx, cy, z, r, depth, from) {
  // open at the front (the face is there; the AI's window looks into it),
  // closed at the back by the profile itself
  KIT().revolve(bag, [cx, cy, z], [0, 0, 1], [[r, from != null ? from : 0.010], [r, depth], [r * 0.9, depth + 0.003], [0.0005, depth + 0.003]], 28, false);
}
// the attitude ball: a DRUM about the lateral (x) axis, its strip wrapped
// 1:1 over 180° of pitch, the front of the drum just proud of the plate;
// the window (0.58 r) then shows ±29°. Sits in a group that carries roll
// (about +z) and pitch (about +x) — one part, two drives.
// THE DRUM IS 1.2 r (session 4b, the user: "the attitude indicator has a
// very visible back ribbon, far too much"): at 1.6 r its rim stood proud of
// the recessed plate below the bezel and the painted strip showed there;
// now the drum is a patch (below) in its own can (canAt), and the can
// clears the neighbours' cans on the T.
// THE DRUM IS A PATCH, NOT A BAND (session 4b): only what the window can
// ever see is drawn — the union, over the pitch the strip carries, of the
// window's circle laid on the drum: a stadium, the window's full width for
// ±34° of drum (the pitch the window shows) then narrowing to nothing by
// ±65°. Anything wider stood in front of the plate beside the bezel once
// the drum was seated proud enough for the window to clear the plate.
function drumInto(bag, slot, r, zFace) {
  const G = PG(), Rd = AI_DRUM_K * r, w = 1.3 * r, rw = AI_WINDOW * r;
  const rows = 29, cols = 9, span = 70 * Math.PI / 180, flat = 34 * Math.PI / 180;
  const zc = zFace + Rd;                          // the axis, into the dash
  const grid = [];
  for (let i = 0; i < rows; i++) {
    const phi = -span + 2 * span * i / (rows - 1);   // pitch on the drum, −70..+70
    const over = Math.max(0, Math.abs(phi) - flat);
    const yw = Rd * Math.sin(over);
    const hw = rw * Math.sqrt(Math.max(0, 1 - (yw / rw) * (yw / rw)));   // the patch's half-width here
    const row = [];
    for (let j = 0; j < cols; j++) {
      const x = -hw + 2 * hw * j / (cols - 1);
      const y = Rd * Math.sin(phi), z = zc - Rd * Math.cos(phi);
      // the strip: u across the drum's width against x (the mirror rule),
      // v up the pitch
      const R = G.slotRect(slot);
      const u = (R.x + (0.5 - x / w) * R.w) / G.ATLAS_W;
      const v = 1 - (R.y + (0.5 - phi / Math.PI) * R.h) / G.ATLAS_H;
      row.push(bag.v([x, y, z], [u, v]));
    }
    grid.push(row);
  }
  for (let i = 0; i < rows - 1; i++)
    for (let j = 0; j < cols - 1; j++)
      bag.quad(grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]);   // outward = −z at the front
}
// the compass card: a vertical drum (axis +y) with the strip round it, the
// current heading facing the pilot (−z)
function cardDrumInto(bag, slot, r, h) {
  const G = PG(), seg = 48, R = G.slotRect(slot, 4);
  const rows = [];
  for (const yy of [-h / 2, h / 2]) {
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const a = 2 * Math.PI * i / seg;              // heading round the drum
      // heading a faces −z at a = 0 and turns the pilot's way: x = −sin, z = −cos
      const x = -r * Math.sin(a), z = -r * Math.cos(a);
      const u = (R.x + (i / seg) * R.w) / G.ATLAS_W;
      const v = 1 - (R.y + (yy > 0 ? 0 : 1) * R.h) / G.ATLAS_H;
      row.push(bag.v([x, yy, z], [u, v]));
    }
    rows.push(row);
  }
  for (let i = 0; i < seg; i++) bag.quad(rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]);
}
// a flat card (the DG's rose) — a disc carrying its slot, turning about +z
function cardDiscInto(bag, slot, r, z) { faceAt(bag, 0, 0, z, r, slot, 48); }

// ---- the switches ------------------------------------------------------------
// the row's base plate, one per switch
function plateAt(bag, x, y, z, pitch) {
  KIT().boxIn(bag, [x, y, z + 0.004], [pitch * 0.31, 0.008, 0.004], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
}
// a toggle: a chromed bat that leans up (on) or down (off) about a lateral
// pivot on the plate — `sw_<key>` drive, 0/1 → ±0.42 rad
function toggleAt(parent, x, y, z, key, on) {
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.004], [1, 0, 0], 'sw_' + key, 'switch',
    { k: 0.42, sgn: 1 });
  const bag = KIT().Bag();
  KIT().revolve(bag, [0, 0, 0], [0, 0, -1], [[0.0018, 0], [0.0018, 0.014], [0.0032, 0.020], [0.0022, 0.023]], 10, true);
  bag.mesh(g, matFor('lever'));
  // the base bushing, fixed
  const bush = KIT().Bag();
  KIT().revolve(bush, [x, y, z - 0.004], [0, 0, -1], [[0.005, 0], [0.005, 0.004], [0.003, 0.005]], 12, true);
  bush.mesh(parent, matFor('barrel'));
  g.rotation.x = (on ? 1 : -1) * 0.42;             // the editor's pose: up is on
  return g;
}
// a dimmer knob: a fluted disc with a pointer, turning about the panel's
// normal — 0..1 → 270° of travel
function knobAt(parent, x, y, z, key, v) {
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.004], [0, 0, 1], 'sw_' + key, 'knob',
    { k: 270 * Math.PI / 180, sgn: 1 });
  const bag = KIT().Bag();
  KIT().revolve(bag, [0, 0, 0], [0, 0, -1], [[0.006, 0], [0.011, 0.001], [0.011, 0.008], [0.009, 0.010], [0.003, 0.010]], 18, true);
  bag.mesh(g, matFor('knob'));
  // the pointer, painted on the knob's top: a small bar
  const p = KIT().Bag();
  KIT().boxIn(p, [0, 0.006, -0.0105], [0.0012, 0.004, 0.0006], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  p.mesh(g, matFor('needle'));
  g.rotation.z = clockRad(-135 + 270 * (v || 0));   // the editor's pose
  return g;
}
// a rocker (master, alternator): a pale block that tips about a lateral
// pivot — on = the top pressed in
function rockerAt(parent, x, y, z, key, on) {
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.003], [1, 0, 0], 'sw_' + key, 'switch',
    { k: 0.22, sgn: 1 });
  const bag = KIT().Bag();
  KIT().boxIn(bag, [0, 0, -0.003], [0.006, 0.011, 0.003], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  bag.mesh(g, matFor('rocker'));
  g.rotation.x = (on ? 1 : -1) * 0.22;
  return g;
}
// the key: a lock barrel in the plate and a brass key standing out of it,
// turning about the panel's normal — OFF / L / R / BOTH / START at 0, 30,
// 60, 90, 120 degrees clockwise
function keyAt(parent, x, y, z, pos) {
  const bag = KIT().Bag();
  KIT().revolve(bag, [x, y, z - 0.002], [0, 0, -1], [[0.009, 0], [0.009, 0.004], [0.006, 0.006]], 16, true);
  bag.mesh(parent, matFor('barrel'));
  const g = gaugeAt(parent, 'edGauge_key', [x, y, z - 0.008], [0, 0, 1], 'key', 'key',
    { k: Math.PI / 6, sgn: 1, steps: ['off', 'l', 'r', 'both', 'start'] });
  const kb = KIT().Bag();
  KIT().boxIn(kb, [0, -0.012, -0.004], [0.0035, 0.014, 0.001], [1, 0, 0], [0, 1, 0], [0, 0, 1]);   // the blade
  KIT().revolve(kb, [0, -0.026, -0.004], [0, 0, 1], [[0.007, -0.001], [0.007, 0.001]], 16, true);   // the bow
  kb.mesh(g, matFor('key'));
  const idx = ['off', 'l', 'r', 'both', 'start'].indexOf(pos || 'both');
  g.rotation.z = clockRad(30 * Math.max(0, idx));
  return g;
}

// ---- the build ------------------------------------------------------------------
const EXT_LIGHTS = ['taxi', 'beacon', 'land', 'nav'];
const INT_LIGHTS = ['flood', 'instr', 'pedal', 'pax'];
let LAST = null, fontsWaited = false;
function build(parent, A, P, pilotX) {
  const G = PG(), K = KIT();
  if (!G || !K) return null;
  MOVING = [];
  const R = resolve();
  if (!R) return null;
  const units = R.units;
  const radios = ['com', 'xpdr'].filter(k => R.avionics[k] !== 'none');
  const lightsOn = P && +P.lightOn;
  const L = G.layout(A, {
    items: R.items, side: R.side, pilotX, radios,
    elec: { hasBus: R.hasBus, altA: R.altA },
    extLights: lightsOn && +P.lightSw ? EXT_LIGHTS : [],
    intLights: lightsOn && +P.lightSw ? INT_LIGHTS : [],
  });
  const grp = new THREE.Group();
  grp.name = 'edPanel';
  parent.add(grp);
  // THE PLATE'S OWN FRAME (session 4b): the dials stand on the dash's face
  // plate, which the crew measured (A.face → L.plane): the group's origin is
  // the plate's top-centre, its +y runs up the plate and its +z is the
  // plate's normal into the dash, so the lean the cage draws the plate with
  // is the group's rotation and every builder keeps its flat (x, y, z). A
  // dial's cage y becomes a distance along the plate; z = 0 IS the plate.
  // Without a measured plate (the bench's flat dash, an older crew record)
  // the frame sits at the band's face, unrotated, as before.
  const PL = L.plane;
  const face = new THREE.Group();
  face.name = 'edPanelFace';
  if (PL) { face.position.set(0, PL.yTop, PL.zTop); face.rotation.x = -PL.tilt; }
  else face.position.set(0, 0, L.zFace);
  grp.add(face);
  const cosT = PL ? Math.cos(PL.tilt) : 1;
  const ly = cy => PL ? (cy - PL.yTop) / cosT : cy;       // cage y → along the plate
  const zF = 0;                                            // the plate's surface
  // ---- the atlas: a slot per face, a strip for the ball, roses for the cards
  const faces = [];
  let slot = 0;
  const slotOf = {};
  const want = (key, painter) => { slotOf[key] = slot; faces.push({ key, slot: slot++, painter }); return slotOf[key]; };
  // a strip takes four slots in one row: start it on a row boundary
  const wantWide = (key, painter, n) => {
    if (slot % G.COLS > G.COLS - n) slot = Math.ceil(slot / G.COLS) * G.COLS;
    slotOf[key] = slot; faces.push({ key, slot, painter, wide: n }); slot += n; return slotOf[key];
  };
  for (const d of L.dials) {
    if (d.k === 'compass') { wantWide('compass:strip', 'compassStrip', 4); continue; }
    if (d.k === 'dg') { want('dg', 'dg'); want('dg:rose', 'rose'); continue; }
    if (d.k === 'ai' || d.k === 'aiE') { want(d.k, 'ai'); want(d.k + ':ball', 'aiBall'); continue; }
    want(d.k, G.FACES[d.k] ? G.FACES[d.k].painter : null);
  }
  const facts = scaleFacts(P);
  const sig = JSON.stringify([units, faces.map(f => f.key), facts]);
  const cv = atlas();
  if (sig !== atlasSig) {
    const g2 = cv.getContext('2d');
    G.paintAtlas(g2, faces, units, facts);
    atlasSig = sig;
    if (atlasTex) atlasTex.needsUpdate = true;
  }
  const fm = facesMaterial();
  fm.emissiveIntensity = faceDim(P) * 1.6;
  // ---- the dials
  const bez = K.Bag(), hub = K.Bag(), sym = K.Bag(), plate = K.Bag(), bowl = K.Bag(), symC = K.Bag();
  const faceBag = UVBag(fm);
  const rest = G.REST;
  const can = K.Bag();
  for (const d of L.dials) {
    const { cx, r } = d;
    const cy = d.coaming ? d.cy : ly(d.cy);
    if (d.coaming) {
      // THE COMPASS: a bowl standing on the coaming, the card turning inside
      // it, read through the aft window. The bowl is a revolve about +y. It
      // is not on the plate: it stands on the glareshield, in the panel's
      // own (unrotated) group, a little forward of the lip.
      const zc = d.z != null ? d.z : (A.dashAftZ != null ? A.dashAftZ : L.zFace) + 0.045;
      // the bowl: a base cup, a cap, and the aft half of the band between
      // them (the card shows through the open front — a real bowl's window)
      K.revolve(bowl, [cx, cy - r * 0.5, zc], [0, 1, 0],
        [[r * 0.55, 0], [r * 0.95, r * 0.12], [r, r * 0.24], [r * 0.7, r * 0.26], [0, r * 0.26]], 28, true);
      K.revolve(bowl, [cx, cy - r * 0.5, zc], [0, 1, 0],
        [[0, r * 0.74], [r * 0.7, r * 0.74], [r, r * 0.76], [r * 0.92, r * 1.1], [r * 0.55, r * 1.35], [0, r * 1.4]], 28, true);
      {
        const seg = 16, y0 = cy - r * 0.5 + r * 0.24, y1 = cy - r * 0.5 + r * 0.76;
        const ring = [];
        for (let i = 0; i <= seg; i++) {
          const a = Math.PI * i / seg;                    // the aft half: z >= zc
          const x = cx + r * Math.cos(a), z = zc + r * Math.sin(a);
          ring.push([bowl.v([x, y0, z]), bowl.v([x, y1, z]), bowl.v([x, y0, z + 0.003]), bowl.v([x, y1, z + 0.003])]);
        }
        for (let i = 0; i < seg; i++) {
          const p = ring[i], q = ring[i + 1];
          bowl.quad(p[0], q[0], q[1], p[1]); bowl.quad(p[3], q[3], q[2], p[2]);
        }
      }
      const g = gaugeAt(grp, 'edGauge_compass_card', [cx, cy, zc], [0, 1, 0], 'hdg', 'card', { sgn: -1, k: 1 });
      const cb = UVBag(fm);
      cardDrumInto(cb, slotOf['compass:strip'], r * 0.62, r * 0.5);
      cb.mesh(g);
      // the lubber line on the window
      K.boxIn(symC, [cx, cy + r * 0.32, zc - r * 0.72], [0.0008, r * 0.14, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      continue;
    }
    const seg = r > 0.035 ? 40 : 28;
    // THE AI STANDS PROUD (session 4b): its drum's front must clear the
    // solid plate (no hole is cut for it), and everything of the drum
    // outside the window must then hide behind the face ring — so the
    // whole instrument, bezel and ring, sits AI_STAND further out than its
    // neighbours, as a real AI's case does, and its can starts at the plate
    const isAI = d.k === 'ai' || d.k === 'aiE';
    const zB = isAI ? zF - AI_STAND : zF;
    bezelAt(bez, cx, cy, zB, r, isAI ? AI_STAND : 0);
    // the mounting flange: a thin annulus on the plate round the bezel (the
    // AI's wide enough to mask its drum wherever the plate's own curvature
    // would otherwise let a corner of the patch through)
    K.revolve(plate, [cx, cy, zF], [0, 0, 1],
      [[r * 0.95, -0.0012], [r * (isAI ? 1.20 : 1.10), -0.0012], [r * (isAI ? 1.20 : 1.10), 0.0015], [r * 0.95, 0.0015]], 40, false);
    // the can behind: the AI's holds its drum, the rest a hand's depth
    canAt(can, cx, cy, zF, isAI ? AI_DRUM_K * r + 0.004 : r * 0.92,
          isAI ? 2 * AI_DRUM_K * r + 0.012 : (r > 0.035 ? 0.055 : 0.042), isAI ? 0.001 : null);
    const F = G.FACES[d.k];
    if (d.k === 'dg') {
      // the fixed face behind, the rose card in front turning about +z, the
      // aeroplane symbol fixed in front of the card
      faceAt(faceBag, cx, cy, zF - 0.004, r * 0.86, slotOf.dg, seg);
      const g = gaugeAt(face, 'edGauge_dg_card', [cx, cy, zF - 0.0055], [0, 0, 1], 'hdg', 'card', { sgn: -1, k: 1 });
      const cb = UVBag(fm);
      cardDiscInto(cb, slotOf['dg:rose'], r * 0.70, 0);
      cb.mesh(g);
      const zs = zF - 0.0075;
      K.boxIn(sym, [cx, cy - r * 0.04, zs], [0.0012, r * 0.26, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx, cy, zs], [r * 0.30, 0.0012, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx, cy + r * 0.20, zs], [r * 0.12, 0.0012, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      continue;
    }
    if (d.k === 'ai' || d.k === 'aiE') {
      // the ball first (deep), the fixed face over it with its window cut by
      // the painter being dark there, the symbol on top
      const g = gaugeAt(face, 'edGauge_' + d.k + '_ball', [cx, cy, zF - 0.004], [0, 0, 1], 'roll', 'ball',
        { sgn: 1, k: 1, axis2: [1, 0, 0], drive2: 'pitch', sgn2: 1, k2: 1 });
      const db = UVBag(fm);
      // the drum's front PROUD of the plate (the plate is solid — no hole is
      // cut for an instrument — so the window must look at a drum that
      // stands in front of it: at 7 mm the plate's plane cuts a 1.2 r drum
      // at 0.62 r, outside the 0.58 r window, and the patch's edge sits
      // 2.5 mm in front of the ring's, hidden from any seat)
      drumInto(db, slotOf[d.k + ':ball'], r, 0.004 - AI_PROUD);
      db.mesh(g);
      // the face over it: a ring, not a disc — the window is open
      const fb2 = faceBag;
      {
        const G2 = PG(), rIn = r * AI_WINDOW, rOut = r * 0.86, zz = zB - 0.0045;
        const inner = [], outer = [];
        for (let i = 0; i < seg; i++) {
          const a = 2 * Math.PI * i / seg;
          inner.push(fb2.v([cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn, zz], G2.faceUV(slotOf[d.k], cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn, cx, cy, 2 * rOut)));
          outer.push(fb2.v([cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut, zz], G2.faceUV(slotOf[d.k], cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut, cx, cy, 2 * rOut)));
        }
        // wound to face the pilot (−z), as faceAt's fans are
        for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; fb2.quad(inner[i], inner[j], outer[j], outer[i]); }
      }
      const zs = zB - 0.0065;
      K.boxIn(sym, [cx - r * 0.27, cy, zs], [r * 0.15, 0.0014, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx + r * 0.27, cy, zs], [r * 0.15, 0.0014, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.revolve(sym, [cx, cy, zs], [0, 0, 1], [[r * 0.035, -0.0008], [r * 0.035, 0.0008]], 10, true);
      continue;
    }
    // every other face: the painted disc, then its hands
    faceAt(faceBag, cx, cy, zF - 0.004, r * 0.86, slotOf[d.k], seg);
    if (!F) continue;
    if (d.k === 'turn') {
      // the aeroplane symbol tilts about +z; the ball sits in its tube
      const g = gaugeAt(face, 'edGauge_turn_plane', [cx, cy, zF - 0.0065], [0, 0, 1], 'r', 'lin', { sgn: 1, k: 1 });
      const sb = K.Bag();
      K.boxIn(sb, [0, 0, 0], [r * 0.62, 0.0018, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sb, [0, r * 0.10, 0], [0.0018, r * 0.12, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sb, [0, -r * 0.02, 0], [r * 0.10, r * 0.06, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      sb.mesh(g, matFor('symbol'));
      K.revolve(hub, [cx, cy + r * 0.50, zF - 0.0065], [0, 0, 1], [[r * 0.055, -0.001], [r * 0.055, 0.001]], 12, true);
      continue;
    }
    for (const H of F.hands) {
      if (H.kind && H.kind !== 'needle') continue;
      const v0 = rest[H.drive] != null ? rest[H.drive] : 0;
      const g = gaugeAt(face, 'edGauge_' + d.k + '_' + H.name, [cx, cy, zF - 0.004],
        [0, 0, 1], H.drive, H.law, { sgn: 1, k: 1, hand: H.name, gauge: d.k,
          per: H.per, units });
      const nb = K.Bag();
      needleInto(nb, H, r * 0.86, 0.0025 + 0.0012 * F.hands.indexOf(H));
      nb.mesh(g, matFor('needle'));
      g.rotation.z = clockRad(G.angleOf(d.k, H, v0, units, facts));
    }
    hubAt(hub, cx, cy, zF - 0.004 - 0.0012 * F.hands.length, r * 0.06);
  }
  // ---- the switch row
  const pitch = L.switches.length > 1 ? Math.abs(L.switches[0].x - L.switches[1].x) : 0.04;
  for (const s of L.switches) {
    const sy = ly(s.y);
    plateAt(plate, s.x, sy, zF, pitch);
    if (s.kind === 'key') keyAt(face, s.x, sy, zF, 'both');
    else if (s.kind === 'rocker') rockerAt(face, s.x, sy, zF, s.k, true);
    else if (s.kind === 'toggle') toggleAt(face, s.x, sy, zF, s.k, +P['li_' + s.k] > 0.5);
    else if (s.kind === 'knob') knobAt(face, s.x, sy, zF, s.k, Math.max(0, Math.min(1, +P['li_' + s.k] || 0)));
  }
  bez.mesh(face, matFor('bezel')); hub.mesh(face, matFor('hub')); sym.mesh(face, matFor('symbol'));
  can.mesh(face, matFor('hub'));
  plate.mesh(face, matFor('plate')); bowl.mesh(grp, matFor('bowl')); symC.mesh(grp, matFor('symbol'));
  faceBag.mesh(face, 'edGauge_faces');
  // the instrument light on the switchboard, as every emitter is (GATE LIGHT's
  // census), declared once per build against the material that glows
  try {
    if (window.LIGHT_RIG && window.LIGHT_RIG.board)
      window.LIGHT_RIG.board('aircraft').declare('ac_instr', 'aircraft: instrument', 'emissive',
        () => { if (facesMat) facesMat.emissiveIntensity = 0; });
  } catch (e) {}
  LAST = { layout: L, faces, slotOf, units, facts, group: grp };
  // THE FONT LANDS AFTER THE FIRST PAINT: the vendored Plex loads async, so
  // the first atlas may be in the fallback face. When the fonts are ready the
  // sheet is painted again in place — same slots, one upload.
  if (HAS_DOM && document.fonts && document.fonts.ready && !fontsWaited) {
    fontsWaited = true;
    document.fonts.ready.then(() => {
      if (!LAST || !atlasCv) return;
      const g3 = atlasCv.getContext('2d');
      PG().paintAtlas(g3, LAST.faces, LAST.units, LAST.facts);
      if (atlasTex) atlasTex.needsUpdate = true;
    }).catch(() => {});
  }
  return { fit: R.tier, n: L.dials.length, overflow: L.overflow.length, ext: L.ext,
           yMid: L.yMid, zFace: L.zFace, xLim: L.xLim, dials: L.dials, switches: L.switches };
}

window.CAGE_PANEL = {
  panel: panelElement,
  fromSpec, toSpec, resolve, state: () => SY,
  render: () => { if (panelBody) renderPanel(); },
  // session 3: the geometry — the crew calls build where its own panel
  // ran; the join reads `moving`; the game rebuilds the faces through
  // `material('faces')`
  build, get moving() { return MOVING; }, MAT,
  material: k => (k === 'faces' ? facesMaterial() : matFor(k)),
  atlas: () => atlasCv, last: () => LAST, faceDim,
  switches: true,                // the light layer leaves the switch row to us
};

})();
