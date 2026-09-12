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
  lever:  { col: 0xd8dde3, rough: 0.12, metal: 0.95 },   // a toggle's bat — the library's plated steel
  screw:  { col: 0xc4c9cf, rough: 0.30, metal: 0.90 },   // the instruments' mounting screws
  knob:   { col: 0x24262b, rough: 0.55, metal: 0.00 },   // a dimmer's knob
  rocker: { col: 0xe9e5dc, rough: 0.60, metal: 0.00 },   // a master rocker
  key:    { col: 0xc9b47a, rough: 0.35, metal: 0.85 },   // brass
  barrel: { col: 0xd8dde3, rough: 0.12, metal: 0.95 },   // the lock's escutcheon and barrel — plated
  bowl:   { col: 0x2a2d33, rough: 0.35, metal: 0.10 },   // the compass bowl
  // the hardware kit's own flat materials (tools/panel_table.py): the
  // pack's GRAY grip, its red guard / cap, its amber lens
  grip:   { col: 0x3a3e46, rough: 0.45, metal: 0.00 },
  cap:    { col: 0xb0281e, rough: 0.40, metal: 0.00 },
  amber:  { col: 0xffb040, rough: 0.30, metal: 0.00 },
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
// THE TAPE LABELS (G282, the user: "I have also generated labels as assets
// for labeling the switches ... stick them at 45 deg angle on top of their
// respective controls"). The user's own hand-written tapes, one column
// sheet built by tools/labels_prep.py (src/viewer/panel_tex.js names the
// tiles); ONE material, bucketed by the join like the faces (`panelSet:
// 'label'`), so the flight rebuilds it through `material('label')`. A
// tape is a quad a hair off the plate, alpha-tested (ragged tape edges,
// no sorting); which tape a switch wears is LABEL_OF.
const LABEL_OF = { pax: 'Cabin', flood: 'Dash', instr: 'Instr', pedal: 'Feet',
                   beacon: 'beac', nav: 'pos', land: 'land', taxi: 'cruise' };
let labelMat = null;
function labelSheet() {
  const S = (typeof PANEL_TEX_SHEETS !== 'undefined') ? PANEL_TEX_SHEETS
          : (typeof window !== 'undefined' && window.PANEL_TEX_SHEETS);
  return S && S.labels ? S.labels : null;
}
function labelMaterial() {
  if (labelMat) return labelMat;
  const sh = labelSheet();
  let tex = null;
  if (sh && sh.img) {
    tex = new THREE.Texture(sh.img);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    const up = () => { tex.needsUpdate = true; };
    // addEventListener, not onload: the sheet's Image is shared with
    // whoever else reads it (G247's lesson)
    if (sh.img.complete && sh.img.naturalWidth) up();
    else sh.img.addEventListener('load', up);
  }
  labelMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.92, metalness: 0,
    alphaTest: 0.5, side: THREE.FrontSide });
  labelMat.userData.aeroskin = 1;
  labelMat.userData.panelSet = 'label';
  labelMat.userData.inside = 1;
  return labelMat;
}
// the quad: `w` across the tape, its tile's aspect tall; the pilot reads it
// left to right, so u runs against x (the mirror rule); v picks the tile
function labelInto(bag, i, n, cx, cy, z, w, h) {
  const v0 = 1 - (i + 1) / n, v1 = 1 - i / n;
  const a = bag.v([cx + w / 2, cy - h / 2, z], [0, v0]), b = bag.v([cx - w / 2, cy - h / 2, z], [1, v0]);
  const c = bag.v([cx - w / 2, cy + h / 2, z], [1, v1]), d = bag.v([cx + w / 2, cy + h / 2, z], [0, v1]);
  bag.quad(a, b, c, d);                                  // facing the pilot (-z)
}
// THE SCREWS' SHADOW (session 4f, the user: "have them cast some AO onto
// the dash, even if you need to fake it with a plane and some
// transparency"): one soft dark disc under each head — a radial gradient on
// a small canvas, transparent, no depth write, a hair above the plate. ONE
// material, bucketed by the join like the faces (`panelSet: 'ao'`), so the
// flight rebuilds it through `material('ao')`.
let aoMat = null;
function aoMaterial() {
  if (aoMat) return aoMat;
  const cv = HAS_DOM ? document.createElement('canvas') : null;
  let tex = null;
  if (cv) {
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(cv);
  }
  aoMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 1,
    depthWrite: false, side: THREE.FrontSide, toneMapped: false });
  aoMat.userData.aeroskin = 1;
  aoMat.userData.panelSet = 'ao';
  aoMat.userData.inside = 1;
  return aoMat;
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
  // a CLOSED profile (session 4d): the inner wall from the lip back to the
  // skirt — without it the drum showed between the AI's ring and its lip
  KIT().revolve(bag, [cx, cy, z], [0, 0, 1],
    [[r * 0.86, -0.008], [r * 0.93, -0.009], [r, -0.006], [r, 0.012 + (skirt || 0)], [r * 0.86, 0.012 + (skirt || 0)], [r * 0.86, -0.008]], 48, false);
}
// THE SCREWS (session 4d, the user: "high quality screwheads around the
// dials ... in the corners of a square inscribing the round dial, that's
// how they're fitted IRL"): a 3-1/8" instrument's four mounting holes sit
// on a 3.44" square, a 2-1/4"'s on 2.44" — 1.09 r either way — and the
// pan heads sit on the plate at those corners. Each head: a domed revolve
// 4.6 mm across with a cross slot, plated steel.
// A SOFT SHADOW UNDER ANYTHING ON THE DASH (session 4h, the user: "use the
// screws AO trick on everything that goes onto the dashboard"): one quad on
// the plate, a hair proud, carrying the radial gradient; `up` lays it in
// the x-z plane instead (the compass on the glareshield)
function aoDiscInto(ao, cx, cy, z, R, up) {
  const q = up ? [[cx - R, z - R], [cx + R, z - R], [cx + R, z + R], [cx - R, z + R]]
               : [[cx - R, cy - R], [cx + R, cy - R], [cx + R, cy + R], [cx - R, cy + R]];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const ids = q.map(([a, b], i) => ao.v(up ? [a, cy, b] : [a, b, z - 0.0003], uv[i]));
  if (up) ao.quad(ids[0], ids[1], ids[2], ids[3]);       // facing +y
  else ao.quad(ids[0], ids[3], ids[2], ids[1]);          // facing the pilot (−z)
}
// ...and as a RING for an instrument the plate is cut open behind (G279):
// a full disc would lie over the hole and shade the ball
function aoRingInto(ao, cx, cy, z, R, rIn) {
  const seg = 24, inner = [], outer = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg, c = Math.cos(a), s2 = Math.sin(a);
    inner.push(ao.v([cx + rIn * c, cy + rIn * s2, z - 0.0003], [0.5 + 0.5 * (rIn / R) * c, 0.5 + 0.5 * (rIn / R) * s2]));
    outer.push(ao.v([cx + R * c, cy + R * s2, z - 0.0003], [0.5 + 0.5 * c, 0.5 + 0.5 * s2]));
  }
  for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; ao.quad(inner[i], outer[i], outer[j], inner[j]); }
}
function screwsAt(bag, slot, ao, cx, cy, z, r) {
  // (4f: a tenth further in and a fifth bigger, with a shadow disc each)
  const K = KIT(), d = r * 0.98, R0 = 0.0028;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = cx + sx * d, y = cy + sy * d;
    if (ao) {
      const ra = R0 * 2.4, q = [[x - ra, y - ra], [x + ra, y - ra], [x + ra, y + ra], [x - ra, y + ra]];
      const ids = q.map(([qx, qy], i) => ao.v([qx, qy, z - 0.0003], [[0, 0], [1, 0], [1, 1], [0, 1]][i]));
      ao.quad(ids[0], ids[3], ids[2], ids[1]);          // wound to face the pilot (−z)
    }
    K.revolve(bag, [x, y, z], [0, 0, -1],
      [[R0, -0.0002], [R0, 0.0007], [R0 * 0.92, 0.0014], [R0 * 0.72, 0.0020], [R0 * 0.42, 0.0024], [0, 0.0025]], 28, false);
    // the cross slot, dark, turned a little each so the four do not line up
    const a = 0.35 + (sx + 2 * sy) * 0.4;
    for (const t of [a, a + Math.PI / 2]) {
      const c = Math.cos(t), sn = Math.sin(t);
      K.boxIn(slot, [x, y, z - 0.0023], [R0 * 0.78, 0.0004, 0.0005], [c, sn, 0], [-sn, c, 0], [0, 0, 1]);
    }
  }
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
// THE BALL IS A BALL, BEHIND A HOLE (G279, the user: "the band of the
// attitude indicator still sticks out ... it's unacceptable to have dozens
// of centimetres of extra visible geometry"). Every earlier cut — the 1.6 r
// drum, the 1.2 r drum, the stadium patch, the 12 mm stand, the 7 mm proud
// front — was a way of keeping a drum in FRONT of a solid plate while
// hiding its rim, and each seat found a new angle to see the rim from. The
// plate is now cut open behind the AI (aeroskin.js AERO_HOLE_FS, fed from
// this layer's `holes`), and the ball is a sphere of AI_BALL r, its front
// pole at the window's plane, inside a closed can behind the plate: seen
// through the window, hidden by the plate everywhere else, nothing proud.
// ...AND THE BALL BULGES THROUGH THE HOLE (G288, the user: "the attitude
// dial is still not quite right"): seated with its pole AT the window's
// plane, the ball sat wholly behind the plate, and from the side of the
// seat a ray through the far half of the window missed it and saw the
// can — half the window dark, the ball a crescent. A real AI's ball domes
// out to the glass. The sphere's centre is set so its surface passes
// exactly through the hole's rim: the dome then covers the whole aperture
// from every angle (any ray into the hole meets the dome first), and the
// pole stands 0.215 r proud — at the bezel's lip, under the symbol. The
// pitch and roll pivot is the sphere's CENTRE (it had been the pole, and
// the ball swung on its nose as the aeroplane pitched).
const AI_BALL = 1.00;              // the sphere's radius over the bezel's
const AI_WINDOW = 0.64;            // the face ring's hole, over the bezel's radius
const AI_HOLE = 0.62;              // the plate's cut-out, under the ring's inner edge
const AI_CTR = Math.sqrt(AI_BALL * AI_BALL - AI_HOLE * AI_HOLE);   // the centre's depth behind the plate, over r
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
// the sphere, parametrised about the LATERAL axis so the pitch drive is a
// pure shift of the strip: beta is the pitch round +x (the strip's v, 1:1
// over 180°), alpha the swing off the dial's vertical plane (the strip's u
// against x — the mirror rule). The front hemisphere only (alpha ±80°): the
// window can see no further round, and the can is closed behind.
function ballInto(bag, slot, r) {
  const G = PG(), Rb = AI_BALL * r, w = 1.3 * r;
  const rows = 37, cols = 17, spanB = Math.PI / 2, spanA = 75 * Math.PI / 180;
  const zc = 0;                                   // the centre IS the group's pivot
  const R = G.slotRect(slot);
  const grid = [];
  for (let i = 0; i < rows; i++) {
    const beta = -spanB + 2 * spanB * i / (rows - 1);
    const row = [];
    for (let j = 0; j < cols; j++) {
      const alpha = -spanA + 2 * spanA * j / (cols - 1);
      const x = Rb * Math.sin(alpha);
      const y = Rb * Math.cos(alpha) * Math.sin(beta);
      const z = zc - Rb * Math.cos(alpha) * Math.cos(beta);
      const u = (R.x + (0.5 - x / w) * R.w) / G.ATLAS_W;
      const v = 1 - (R.y + (0.5 - beta / Math.PI) * R.h) / G.ATLAS_H;
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

// ---- THE HARDWARE KIT (session 4c) --------------------------------------------
// The user's assets (assets/interior/*.glb), declared in tools/panel_table.py
// and baked by tools/panel_prep.py into props packs (src/panelhw/) the game
// registers on PROP_REG like the hangar's. A piece is fetched once through
// the props' own warm path, decoded with the props codec and kept as
// geometries per material; the LAYER'S materials replace the pack's flat
// colours by name (SILVER → the bare-metal lever, BLACK → the black knob,
// GRAY → grip, the red 'material' → cap, AMBER → amber), and a textured
// piece (the key) keeps the props' one material. Every piece stands along
// +y on y = 0 in the pack; `hwStand` turns it out of the plate (−z here).
// Absent the packs (the bench, a headless load) or before the bytes land,
// the procedural pieces below draw, and the editor rebuilds once when the
// kit is in.
const HW_MAT = { SILVER: 'lever', BLACK: 'knob', GRAY: 'grip', material: 'cap', AMBER: 'amber' };
const HW = { built: {}, asked: {}, rebuild: null };
function hwProp(key) {
  const R = (typeof PROP_REG !== 'undefined') ? PROP_REG : (typeof window !== 'undefined' && window.PROP_REG);
  return R && R.props ? R.props[key] || null : null;
}
function hwGet(key) {
  if (HW.built[key]) return HW.built[key];
  const prop = hwProp(key);
  if (!prop || typeof propReady !== 'function' || typeof propBuild !== 'function') return null;
  if (!propReady(key)) {
    if (!HW.asked[key] && typeof propWarm === 'function') {
      HW.asked[key] = true;
      propWarm(key).then(() => {
        // one rebuild for the whole kit, once the last asked-for piece is in
        clearTimeout(HW.rebuild);
        HW.rebuild = setTimeout(() => { if (window.CAGE_UI && window.CAGE_UI.build) window.CAGE_UI.build(); }, 60);
      }).catch(e => console.warn('panel kit:', key, e));
    }
    return null;
  }
  const b = propBuild(THREE, key);              // geometries + the props' materials, cached
  const parts = b.geos.map((geo, i) => {
    const name = b.prop.parts[i].mat, rec = b.prop.mats[name];
    // (4f: the key's own scan reads green under our light — it takes the
    // library's plated finish like the lock; the textured path stays for a
    // piece whose maps are worth keeping)
    const mat = (rec && rec.map && key !== 'hw_key') ? b.mats[i] : matFor(key === 'hw_key' ? 'key' : (HW_MAT[name] || 'knob'));
    if (rec && rec.map && key !== 'hw_key') { mat.userData.propMat = key + '|' + name; mat.userData.aeroskin = 1; }
    return { geo, mat, name };
  });
  return (HW.built[key] = { prop, parts, bb: prop.bb });
}
// a kit piece as meshes under `parent`, standing out of the plate at (x, y,
// z): pack +y → −z, pack +z → +y (up the panel), pack +x → +x; `spin` turns
// it about its own axis first (a pointer to 12 o'clock)
function hwStand(parent, key, x, y, z, spin, scale, only) {
  const k = hwGet(key);
  if (!k) return null;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.x = -Math.PI / 2;
  if (scale) g.scale.setScalar(scale);
  const inner = new THREE.Group();
  if (spin) inner.rotation.y = spin;
  g.add(inner);
  for (const p of k.parts) {
    if (only && !only(p.name)) continue;                 // a piece's moving part from its fixed one
    const m = new THREE.Mesh(p.geo, p.mat); m.userData.sharedGeo = true; inner.add(m);
  }
  parent.add(g);
  return g;
}
// which way a pointer knob points in the pack: the vertex farthest from the
// axis in the top third, as an angle about +y (0 = +z)
function hwPointer(key) {
  const k = hwGet(key);
  if (!k) return 0;
  if (k.pointer != null) return k.pointer;
  let best = 0, ang = 0;
  const top = k.bb[4] - (k.bb[4] - k.bb[1]) * 0.35;
  for (const p of k.parts) {
    const P = p.geo.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if (y < top) continue;
      const r = Math.hypot(x, z);
      if (r > best) { best = r; ang = Math.atan2(x, z); }
    }
  }
  return (k.pointer = ang);
}

// ---- the switches ------------------------------------------------------------
// THE HARDWARE, REMODELLED (session 4c, the user: "give some extra love to
// the switches and buttons ... a proper hexagonal base for the switches,
// proper size of the base, proper metal material from the library ... the
// knobs with little side ridges, slightly conical with a plastic material
// ... the push button should have a base in the dashboard and a proper
// material, and small bevels"). Every piece is at its real size: an MS-type
// toggle's 11 mm hex nut, 6.3 mm bushing and 22 mm bat; a 20 mm dimmer knob
// with eighteen ridges, tapering to 16 mm over 12 mm of height; a rocker in
// a 15 x 24 mm bezel with a chamfered cap; a lock with a dished escutcheon,
// a keyway and a key with a bow, a neck and a bitted blade. The bare-metal
// pieces take the library's bareAlu (`lever`, `barrel`), the key its brass,
// the plastic ones `knob` / `rocker` / `plate`.
// sections for the KIT's sweep, in its (u, v) plane
const hexSect = R => { const o = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; o.push([R * Math.cos(a), R * Math.sin(a)]); } return o; };
const rectSect = (hw, hh, ch) => ch > 0
  ? [[-hw + ch, -hh], [hw - ch, -hh], [hw, -hh + ch], [hw, hh - ch], [hw - ch, hh], [-hw + ch, hh], [-hw, hh - ch], [-hw, -hh + ch]]
  : [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
const ridgedSect = (R, n, depth, segs) => { const o = []; for (let i = 0; i < segs; i++) { const a = 2 * Math.PI * i / segs; const rr = R * (1 - depth + depth * Math.cos(n * a)); o.push([rr * Math.cos(a), rr * Math.sin(a)]); } return o; };
// a chamfered block standing OUT of the plate (−z) from z0 to z1, its top
// edges bevelled by `ch`
function bevelBlockInto(bag, x, y, z0, z1, hw, hh, ch) {
  const path = [[x, y, z0], [x, y, z1 + ch], [x, y, z1]];
  KIT().sweep(bag, path, t => rectSect(hw - (t > 0.99 ? ch : 0), hh - (t > 0.99 ? ch : 0), ch * 0.5), true, [0, 1, 0]);
}
// (no plate under a switch any more: a toggle stands on its own nut, a knob
// on its skirt, a rocker in its bezel, the key in its escutcheon)
// a toggle: the hex nut on the plate, the threaded bushing through it and
// the chromed bat that leans up (on) or down (off) about the bushing's top
// — `sw_<key>` drive, 0/1 → ±0.42 rad
function toggleAt(parent, x, y, z, key, on, kind) {
  const K = KIT();
  const base = K.Bag();
  // THE NUT (G289, the user: "the hexagonal base of the switches should be
  // larger, and you may want to add a tiny bevel on the hard edges"): a
  // 14 mm AF hex nut seated ON the plate (it had floated 1.5 mm off it,
  // 11 mm across), 4.6 mm tall, its front edge chamfered 0.8 mm — the
  // section shrinks over the last tenth of the sweep
  K.sweep(base, [[x, y, z], [x, y, z - 0.0038], [x, y, z - 0.0046]],
    t => hexSect((t > 0.9 ? 0.0124 : 0.0140) / Math.sqrt(3)), true, [0, 1, 0]);
  // the bushing, 6.3 mm, standing 4 mm out of the nut; the bat pivots at its top
  K.revolve(base, [x, y, z - 0.0046], [0, 0, -1], [[0.00315, 0], [0.00315, 0.0034], [0.0026, 0.0039], [0, 0.0039]], 24, false);
  base.mesh(parent, matFor('barrel'));
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.0085], [1, 0, 0], 'sw_' + key, 'switch',
    { k: 0.42, sgn: 1 });
  const bat = K.Bag();
  // THE BAT (session 4d, the user: "slightly teardrop shaped, with the tip
  // in contact with the fingers being widest than the root ... still too
  // flimsy"): a stout teardrop, 2.4 mm at the root swelling to 4.4 mm near
  // the tip and rounding off, 24 mm out of the bushing, plated
  K.revolve(bat, [0, 0, 0], [0, 0, -1],
    [[0.0026, -0.0005], [0.0024, 0.0020], [0.0023, 0.0060], [0.0026, 0.0110], [0.0033, 0.0150], [0.0040, 0.0185],
     [0.0044, 0.0210], [0.0041, 0.0228], [0.0030, 0.0240], [0.0012, 0.0246], [0, 0.0247]], 28, true);
  bat.mesh(g, matFor('lever'));
  g.rotation.x = (on ? 1 : -1) * 0.42;             // the editor's pose: up is on
  return g;
}
// a dimmer knob: a ridged, slightly conical plastic knob on a thin skirt,
// with a pointer line, turning about the panel's normal — 0..1 → 270°
function knobAt(parent, x, y, z, key, v) {
  const K = KIT();
  // THE KIT'S POINTER KNOB when it is in, its nose turned to 12 o'clock at
  // rest so the law's −135° + 270°·v reads as every other knob's
  if (hwGet('hw_knob')) {
    const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.0005], [0, 0, 1], 'sw_' + key, 'knob',
      { k: 270 * Math.PI / 180, sgn: 1 });
    hwStand(g, 'hw_knob', 0, 0, 0, -hwPointer('hw_knob'));
    g.rotation.z = clockRad(-135 + 270 * (v || 0));
    return g;
  }
  const skirt = K.Bag();
  K.revolve(skirt, [x, y, z + 0.0005], [0, 0, -1], [[0.0115, 0], [0.0115, 0.0015], [0.0100, 0.0022], [0, 0.0022]], 32, false);
  skirt.mesh(parent, matFor('plate'));
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.002], [0, 0, 1], 'sw_' + key, 'knob',
    { k: 270 * Math.PI / 180, sgn: 1 });
  const body = K.Bag();
  // eighteen ridges, 20 mm at the skirt tapering to 16 mm at the top, 12 mm tall
  K.sweep(body, [[0, 0, 0], [0, 0, -0.0105], [0, 0, -0.012]],
    t => ridgedSect(0.0100 - 0.0020 * Math.min(1, t / 0.875) - (t > 0.9 ? 0.0012 : 0), 18, 0.045, 54), true, [0, 1, 0]);
  body.mesh(g, matFor('knob'));
  // the pointer: a pale line from the centre out on the top, and down the side
  const p = K.Bag();
  K.boxIn(p, [0, 0.0045, -0.0122], [0.0007, 0.0035, 0.0004], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  K.boxIn(p, [0, 0.0084, -0.0062], [0.0007, 0.0004, 0.0055], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  p.mesh(g, matFor('needle'));
  g.rotation.z = clockRad(-135 + 270 * (v || 0));   // the editor's pose
  return g;
}
// the button's cap: the light layer's cup material (an emissive the flight
// drives per switch through its lamp records), keyed by the switch
const litCaps = {};
function litCapMat(key, on) {
  if (litCaps[key]) return litCaps[key];
  const L = window.CAGE_LIGHT;
  let m = L && L.cupMat ? L.cupMat(on ? 0.6 : 0, 0xf2ead6, true, key) : null;
  if (!m) { m = matFor('rocker'); return m; }
  return (litCaps[key] = m);
}
// a rocker (master, alternator): a bezel let into the dash and a pale
// chamfered cap that tips about a lateral pivot — on = the top pressed in
function rockerAt(parent, x, y, z, key, on) {
  const K = KIT();
  // THE LIT PUSH BUTTON (session 4d, the user: "I liked the push button,
  // especially if they can be lit when on. You could keep those"): the
  // bevelled bezel let into the dash, the pale chamfered cap that tips,
  // and the cap's material is a LAMP — stamped `lampCup` so the join gives
  // it a bucket of its own and the cockpit lights it when the switch is on
  const bez = K.Bag();
  bevelBlockInto(bez, x, y, z + 0.0005, z - 0.0030, 0.0075, 0.0120, 0.0008);
  bez.mesh(parent, matFor('plate'));
  const g = gaugeAt(parent, 'edGauge_sw_' + key, [x, y, z - 0.0030], [1, 0, 0], 'sw_' + key, 'switch',
    { k: 0.22, sgn: 1 });
  const cap = K.Bag();
  bevelBlockInto(cap, 0, 0, 0.0005, -0.0050, 0.0060, 0.0100, 0.0010);
  cap.mesh(g, litCapMat(key, on));
  g.rotation.x = (on ? 1 : -1) * 0.22;
  return g;
}
// the key: a dished escutcheon on the dash, the lock barrel standing out of
// it with its keyway, and a brass key — a bow with a hole, a neck, a bitted
// blade — turning about the panel's normal: OFF / L / R / BOTH / START at
// 0, 30, 60, 90, 120 degrees clockwise
function keyAt(parent, x, y, z, pos) {
  const K = KIT();
  // THE KIT'S KEY when it is in, in the lock the user described: "a simple
  // chamfered cylinder, very thin, with an inside ridge and a keyhole with
  // the key slotted in. Metal material." The escutcheon is a 22 mm disc
  // chamfered at its rim, 2.5 mm proud, with a raised ring round the keyway;
  // the keyway a dark slot; the key stands out of it, its bow down, and
  // turns with the lock's law.
  if (hwGet('hw_key')) {
    const lock = K.Bag();
    // 15 mm radius, chamfered, 3 mm proud, an inside ridge round a keyway
    // the key's blade fills (session 4d: "slightly bigger so it can slot in
    // the full key")
    K.revolve(lock, [x, y, z + 0.0005], [0, 0, -1],
      [[0.0125, 0], [0.0125, 0.0020], [0.0112, 0.0032], [0.0072, 0.0032], [0.0066, 0.0044], [0.0052, 0.0044], [0.0046, 0.0032], [0, 0.0032]], 48, false);
    lock.mesh(parent, matFor('barrel'));
    const way = K.Bag();
    K.boxIn(way, [x, y, z - 0.0034], [0.0011, 0.0048, 0.0004], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    way.mesh(parent, matFor('hub'));
    // OFF sits at half past seven (session 4e, the user: "rotate it 45°"):
    // a wrapper turned 45° clockwise carries the key's group, so the law's
    // 30° steps run OFF 7:30 → L → R → BOTH 10:30 → START 11:30, the way an
    // ignition switch is marked
    const wrap = new THREE.Group();
    wrap.position.set(x, y, z - 0.0038);
    wrap.rotation.z = clockRad(45);
    parent.add(wrap);
    const g = gaugeAt(wrap, 'edGauge_key', [0, 0, 0], [0, 0, 1], 'key', 'key',
      { k: Math.PI / 6, sgn: 1, steps: ['off', 'l', 'r', 'both', 'start'] });
    // the key lies flat in its own x-y plane in the bake, blade toward +x,
    // bow at −x, 1.5 mm thick along z. In the lock: the blade INTO the lock
    // (pack +x → local +z), the blade's width up the keyway (pack y → local
    // −y), the thickness across (pack z → local +x); the blade's tip 12 mm
    // in, so 50 mm of key stands out toward the pilot
    const k = hwGet('hw_key');
    const kg = new THREE.Group();
    kg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)));
    // (4f: "much too big as it stands. It just needed to be thicker in its
    // slice thickness, not bigger overall") — 0.8 of the delivered 62 mm,
    // and twice as thick in the slice. IN THE PACK'S OWN AXES (G289, the
    // user: "the key looks odd, are you sure it did not get squeezed? Its
    // head should be round"): Object3D scales before it rotates, so the
    // three numbers are the pack's x (the blade's length), y (its width)
    // and z (the slice) — 4f wrote them in the lock's frame and stretched
    // the key 1.6 along its length while thinning the slice: an oval bow
    // and a wafer of a key. The bow is round again.
    kg.scale.set(0.8, 0.8, 1.6);
    // (G282, the user: "the key should be slotted in maybe 8 mm more") —
    // the blade's tip 20 mm in, 42 mm of key toward the pilot
    kg.position.set(0, 0, 0.020 - k.bb[3] * 0.8);
    for (const p of k.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.userData.sharedGeo = true; kg.add(m); }
    g.add(kg);
    const idx = ['off', 'l', 'r', 'both', 'start'].indexOf(pos || 'both');
    g.rotation.z = clockRad(30 * Math.max(0, idx));
    return g;
  }
  const lock = K.Bag();
  K.revolve(lock, [x, y, z + 0.0005], [0, 0, -1], [[0.0115, 0], [0.0115, 0.0015], [0.0100, 0.0028], [0.0068, 0.0028]], 32, false);   // the escutcheon
  K.revolve(lock, [x, y, z - 0.0028], [0, 0, -1], [[0.0068, 0], [0.0064, 0.0035], [0.0058, 0.0042], [0, 0.0042]], 32, false);      // the barrel
  lock.mesh(parent, matFor('barrel'));
  const way = K.Bag();                                  // the keyway, dark
  K.boxIn(way, [x, y, z - 0.0070], [0.0010, 0.0038, 0.0003], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  way.mesh(parent, matFor('hub'));
  const g = gaugeAt(parent, 'edGauge_key', [x, y, z - 0.0070], [0, 0, 1], 'key', 'key',
    { k: Math.PI / 6, sgn: 1, steps: ['off', 'l', 'r', 'both', 'start'] });
  const kb = K.Bag();
  // the blade: in the keyway, out to the neck
  K.boxIn(kb, [0, -0.0035, -0.0012], [0.0009, 0.0060, 0.0009], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  // the neck: the flat shank between the lock and the bow
  bevelBlockInto(kb, 0, -0.0125, -0.0010, -0.0030, 0.0030, 0.0040, 0.0006);
  // the bow: a flat ring, 17 mm across with a 6 mm hole, 2 mm thick
  K.revolve(kb, [0, -0.0235, -0.0010], [0, 0, -1],
    [[0.0030, 0], [0.0085, 0], [0.0085, 0.0020], [0.0030, 0.0020], [0.0030, 0]], 28, false);
  kb.mesh(g, matFor('key'));
  // the bittings: three dark notches along the blade's edge
  const bits = K.Bag();
  for (const [yy, d] of [[-0.0020, 0.0006], [-0.0042, 0.0009], [-0.0064, 0.0005]])
    K.boxIn(bits, [-0.0009 + d / 2, yy, -0.0012], [d / 2, 0.0007, 0.0010], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  bits.mesh(g, matFor('hub'));
  const idx = ['off', 'l', 'r', 'both', 'start'].indexOf(pos || 'both');
  g.rotation.z = clockRad(30 * Math.max(0, idx));
  return g;
}

// ---- the build ------------------------------------------------------------------
const EXT_LIGHTS = ['taxi', 'beacon', 'land', 'nav'];
const INT_LIGHTS = ['flood', 'instr', 'pedal', 'pax'];
let LAST = null, fontsWaited = false;
// THE HOLES (G279): [{ g (the dial's group), r }] as built, resolved by
// `holesIn(parent)` to centres in the parent's frame once the tree stands
let HOLES = [];
function holesIn(parent) {
  parent.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  return HOLES.slice(0, 2).map(h => {
    h.g.getWorldPosition(v); parent.worldToLocal(v);
    return { x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4), r: +h.r.toFixed(4) };
  });
}
function build(parent, A, P, pilotX) {
  HOLES = [];
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
  // ...and the plate's own depth there (session 4c): the fitted plane is
  // within millimetres of the plate, and millimetres are what a face's
  // standing needs — each dial and switch is seated at the plate's
  // measured z under it, as an offset along the frame's normal
  const dzAt = (cx, cy) => {
    if (!PL || !A.face || !A.face.depthAt) return 0;
    const zPlane = PL.zTop + (PL.yTop - cy) * Math.tan(PL.tilt);
    return (A.face.depthAt(cx, cy) - zPlane) * cosT;
  };
  const zF0 = 0;                                           // the fitted plane
  // ...and its LOCAL NORMAL (session 4c, the user: "you struggle matching
  // the pitch of those to align them with the dashboard plane"): seating a
  // dial's centre on the plate is not enough on a curved plate — its lower
  // half went behind the surface. Each dial and switch stands in its own
  // group, turned to the plate's slope under it (the chord across its own
  // width and height), so its face lies ON the plate all round.
  const slopeAt = (cx, cy, h) => {
    if (!PL || !A.face || !A.face.depthAt) return [0, 0];
    const sy = (dzAt(cx, cy + h) - dzAt(cx, cy - h)) / (2 * h / cosT);   // along the plate, up
    const sx = (dzAt(cx + h, cy) - dzAt(cx - h, cy)) / (2 * h);           // across
    return [Math.atan(sy), -Math.atan(sx)];                                // rotation.x, rotation.y
  };
  const standOn = (cx, cy, r) => {                         // a group on the plate at a cage (cx, cy)
    const g2 = new THREE.Group();
    g2.position.set(cx, ly(cy), zF0 + dzAt(cx, cy));
    const [rx, ry] = slopeAt(cx, cy, Math.max(0.01, r * 0.8));
    g2.rotation.set(rx, ry, 0);
    face.add(g2);
    return g2;
  };
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
  const bowl = K.Bag(), symC = K.Bag();
  const rest = G.REST;
  for (const d of L.dials) {
    const r = d.r;
    // on the plate: the dial's own group, and (0, 0, 0) is its centre on the
    // plate's surface; on the coaming: the panel's own frame
    const dg = d.coaming ? null : standOn(d.cx, d.cy, r);
    const cx = d.coaming ? d.cx : 0;
    const cy = d.coaming ? d.cy : 0;
    const zF = 0;
    const bez = K.Bag(), hub = K.Bag(), sym = K.Bag(), plate = K.Bag(), can = K.Bag();
    const screw = K.Bag(), slotB = K.Bag();
    const faceBag = UVBag(fm), aoBag = UVBag(aoMaterial());
    if (d.coaming) {
      // THE COMPASS: a bowl standing on the coaming, the card turning inside
      // it, read through the aft window. The bowl is a revolve about +y. It
      // is not on the plate: it stands on the glareshield, in the panel's
      // own (unrotated) group, a little forward of the lip.
      const zc = d.z != null ? d.z : (A.dashAftZ != null ? A.dashAftZ : L.zFace) + 0.045;
      // the bowl: a base cup, a cap, and the aft half of the band between
      // them (the card shows through the open front — a real bowl's window)
      // THE MOUNT (session 4c, the user: "the compass mesh could be higher
      // poly and more detailed, including its mount on the dashboard"): a
      // chamfered base plate on the glareshield with two screws, a short
      // pedestal, the bowl on it — base cup, chrome band round the card's
      // window, domed cap — 48 segments round.
      const yB = cy - r * 0.5;                      // the bowl's foot
      const mount = K.Bag();
      K.revolve(mount, [cx, yB - 0.003, zc], [0, 1, 0],
        [[r * 0.98, 0], [r * 0.98, 0.0025], [r * 0.92, 0.0032], [r * 0.58, 0.0032], [r * 0.58, 0.0060], [r * 0.52, 0.0060], [0, 0.0060]], 48, false);
      K.bolt(mount, [cx + r * 0.82, yB - 0.003 + 0.0032, zc + r * 0.02], [0, 1, 0], 0.0022, 0.0012);
      K.bolt(mount, [cx - r * 0.82, yB - 0.003 + 0.0032, zc + r * 0.02], [0, 1, 0], 0.0022, 0.0012);
      K.revolve(bowl, [cx, yB, zc], [0, 1, 0],
        [[r * 0.52, 0], [r * 0.90, r * 0.10], [r, r * 0.22], [r * 0.7, r * 0.26], [0, r * 0.26]], 48, true);
      {
        // the cap: a quarter-ellipse sampled fine (session 4d: "the top is too
        // low poly. Ensure that this is smooth and rounded from the pilot
        // perspective") — 16 points from the band to the crown
        const prof = [[0, r * 0.74], [r * 0.7, r * 0.74], [r, r * 0.76]];
        for (let i = 1; i <= 16; i++) {
          const t = i / 16, a = t * Math.PI / 2;
          prof.push([r * Math.cos(a) * (1 - 0.02 * t), r * 0.76 + r * 0.64 * Math.sin(a)]);
        }
        K.revolve(bowl, [cx, yB, zc], [0, 1, 0], prof, 64, true);
      }
      {
        // the aft half-band (the bowl's back) and, on the front, the chrome
        // frame round the window: two arcs and two uprights, swept tubes
        const seg = 32, y0 = yB + r * 0.24, y1 = yB + r * 0.76;
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
        const arc = yy => { const o = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; o.push([cx + r * Math.cos(a), yy, zc - r * Math.sin(a)]); } return o; };
        K.sweep(mount, arc(y0), () => K.secRound(0.0016, 10), true);
        K.sweep(mount, arc(y1), () => K.secRound(0.0016, 10), true);
        K.sweep(mount, [[cx + r, y0, zc], [cx + r, y1, zc]], () => K.secRound(0.0016, 10), true);
        K.sweep(mount, [[cx - r, y0, zc], [cx - r, y1, zc]], () => K.secRound(0.0016, 10), true);
      }
      mount.mesh(grp, matFor('barrel'));
      {
        const sb = UVBag(aoMaterial());
        aoDiscInto(sb, cx, yB - 0.003 + 0.0004, zc, r * 1.35, true);
        const m = sb.mesh(grp, 'edGauge_ao'); if (m) m.renderOrder = 2;
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
    // THE AI SEATS LIKE THE OTHERS (G279): the plate is cut open behind it
    // (the hole, below) and the ball lives in the can, so nothing stands
    // proud any more — the 4b/4d stand and the proud drum are gone
    const isAI = d.k === 'ai' || d.k === 'aiE';
    const zB = zF;
    bezelAt(bez, cx, cy, zB, r, 0);
    // the mounting flange: a thin annulus on the plate round the bezel (the
    // AI's wide enough to mask its drum wherever the plate's own curvature
    // would otherwise let a corner of the patch through)
    K.revolve(plate, [cx, cy, zF], [0, 0, 1],
      [[r * 0.95, -0.0010], [r * 1.04, -0.0010], [r * 1.04, 0.0015], [r * 0.95, 0.0015]], 48, false);
    // the instrument's own shadow, round the flange (a ring over a hole)
    if (isAI) aoRingInto(aoBag, cx, cy, zF, r * 1.34, r * (AI_HOLE + 0.04));
    else aoDiscInto(aoBag, cx, cy, zF, r * 1.34);
    screwsAt(screw, slotB, aoBag, cx, cy, zF, r);
    // the can behind: the AI's holds its ball, the rest a hand's depth
    canAt(can, cx, cy, zF, isAI ? r * 0.97 : r * 0.92,
          isAI ? (AI_CTR + AI_BALL) * r + 0.012 : (r > 0.035 ? 0.055 : 0.042), isAI ? 0.001 : null);
    // THE HOLE (G279): the facia's shader cuts this disc out behind the AI;
    // published in the layer's frame, the crew layer hands it to AEROSKIN
    // (and the join to the flown aeroplane) in craft space
    if (isAI && dg) HOLES.push({ g: dg, r: r * AI_HOLE });
    const F = G.FACES[d.k];
    const meshDial = () => {
      bez.mesh(dg, matFor('bezel')); hub.mesh(dg, matFor('hub')); sym.mesh(dg, matFor('symbol'));
      can.mesh(dg, matFor('hub')); plate.mesh(dg, matFor('plate'));
      screw.mesh(dg, matFor('screw')); slotB.mesh(dg, matFor('hub'));
      faceBag.mesh(dg, 'edGauge_faces');
      { const m = aoBag.mesh(dg, 'edGauge_ao'); if (m) m.renderOrder = 2; }
    };
    if (d.k === 'dg') {
      // the fixed face behind, the rose card in front turning about +z, the
      // aeroplane symbol fixed in front of the card
      faceAt(faceBag, cx, cy, zF - 0.004, r * 0.86, slotOf.dg, seg);
      const g = gaugeAt(dg, 'edGauge_dg_card', [cx, cy, zF - 0.0055], [0, 0, 1], 'hdg', 'card', { sgn: -1, k: 1 });
      const cb = UVBag(fm);
      cardDiscInto(cb, slotOf['dg:rose'], r * 0.70, 0);
      cb.mesh(g);
      const zs = zF - 0.0075;
      K.boxIn(sym, [cx, cy - r * 0.04, zs], [0.0012, r * 0.26, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx, cy, zs], [r * 0.30, 0.0012, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx, cy + r * 0.20, zs], [r * 0.12, 0.0012, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      meshDial(); continue;
    }
    if (d.k === 'ai' || d.k === 'aiE') {
      // the ball first (deep), the fixed face over it with its window cut by
      // the painter being dark there, the symbol on top
      const g = gaugeAt(dg, 'edGauge_' + d.k + '_ball', [cx, cy, zF + AI_CTR * r], [0, 0, 1], 'roll', 'ball',
        { sgn: 1, k: 1, axis2: [1, 0, 0], drive2: 'pitch', sgn2: 1, k2: 1 });
      const db = UVBag(fm);
      // the ball about its own centre, doming out through the hole (G288)
      ballInto(db, slotOf[d.k + ':ball'], r);
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
      const zs = zB - 0.0115;                            // clear of the dome's pole (G288)
      K.boxIn(sym, [cx - r * 0.27, cy, zs], [r * 0.15, 0.0014, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sym, [cx + r * 0.27, cy, zs], [r * 0.15, 0.0014, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.revolve(sym, [cx, cy, zs], [0, 0, 1], [[r * 0.035, -0.0008], [r * 0.035, 0.0008]], 10, true);
      meshDial(); continue;
    }
    // every other face: the painted disc, then its hands
    faceAt(faceBag, cx, cy, zF - 0.004, r * 0.86, slotOf[d.k], seg);
    if (!F) { meshDial(); continue; }
    if (d.k === 'turn') {
      // the aeroplane symbol tilts about +z; the ball sits in its tube
      const g = gaugeAt(dg, 'edGauge_turn_plane', [cx, cy, zF - 0.0065], [0, 0, 1], 'r', 'lin', { sgn: 1, k: 1 });
      const sb = K.Bag();
      K.boxIn(sb, [0, 0, 0], [r * 0.62, 0.0018, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sb, [0, r * 0.10, 0], [0.0018, r * 0.12, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      K.boxIn(sb, [0, -r * 0.02, 0], [r * 0.10, r * 0.06, 0.0008], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
      sb.mesh(g, matFor('symbol'));
      K.revolve(hub, [cx, cy + r * 0.50, zF - 0.0065], [0, 0, 1], [[r * 0.055, -0.001], [r * 0.055, 0.001]], 12, true);
      meshDial(); continue;
    }
    for (const H of F.hands) {
      if (H.kind && H.kind !== 'needle') continue;
      const v0 = rest[H.drive] != null ? rest[H.drive] : 0;
      const g = gaugeAt(dg, 'edGauge_' + d.k + '_' + H.name, [cx, cy, zF - 0.004],
        [0, 0, 1], H.drive, H.law, { sgn: 1, k: 1, hand: H.name, gauge: d.k,
          per: H.per, units });
      const nb = K.Bag();
      needleInto(nb, H, r * 0.86, 0.0025 + 0.0012 * F.hands.indexOf(H));
      nb.mesh(g, matFor('needle'));
      g.rotation.z = clockRad(G.angleOf(d.k, H, v0, units, facts));
    }
    hubAt(hub, cx, cy, zF - 0.004 - 0.0012 * F.hands.length, r * 0.06);
    meshDial();
  }
  // ---- the switch row, each on the plate under it
  for (const s of L.switches) {
    const sg = standOn(s.x, s.y, 0.012);
    {
      const sb = UVBag(aoMaterial());
      aoDiscInto(sb, 0, 0, 0, { key: 0.020, rocker: 0.018, toggle: 0.011, knob: 0.015 }[s.kind] || 0.012);
      const m = sb.mesh(sg, 'edGauge_ao'); if (m) m.renderOrder = 2;
    }
    if (s.kind === 'key') keyAt(sg, 0, 0, 0, 'both');
    else if (s.kind === 'rocker') rockerAt(sg, 0, 0, 0, s.k, true);
    else if (s.kind === 'toggle') toggleAt(sg, 0, 0, 0, s.k, +P['li_' + s.k] > 0.5);
    else if (s.kind === 'knob') {
      knobAt(sg, 0, 0, 0, s.k, Math.max(0, Math.min(1, +P['li_' + s.k] || 0)));
      // THE GRADUATION (G284, the user: "some simple graduation straight
      // on the dashboard for the potentiometer controlling the interior
      // light intensity"): eleven silk-screened ticks round the knob on the
      // plate, on the knob's own law (-135 deg at off, +135 at full,
      // clockwise for the pilot), the ends and the middle longer
      const tk = K.Bag();
      for (let i = 0; i <= 10; i++) {
        const a = clockRad(-135 + 27 * i), major = i % 5 === 0;
        const rd = [-Math.sin(a), Math.cos(a), 0], tg = [Math.cos(a), Math.sin(a), 0];
        const rr = 0.0125 + (major ? 0.0014 : 0.0010);
        K.boxIn(tk, [rd[0] * rr, rd[1] * rr, -0.0003], [major ? 0.0014 : 0.0010, 0.0003, 0.0003], rd, tg, [0, 0, 1]);
      }
      tk.mesh(sg, matFor('needle'));
    }
    // THE TAPE (G282): stuck over the switch, a hair off the plate over the
    // shadow disc — flat (G284, the user: "they would fit horizontally, so
    // no need for the 45 degrees"), and a touch larger for it
    const sheet = labelSheet(), li = sheet ? sheet.names.indexOf(LABEL_OF[s.k]) : -1;
    if (li >= 0) {
      const lg = new THREE.Group();
      lg.position.set(0, 0.019, -0.0006);
      sg.add(lg);
      const lb = UVBag(labelMaterial());
      const w = 0.030, h = w * sheet.h / sheet.w;
      labelInto(lb, li, sheet.n, 0, 0, 0, w, h);
      const m = lb.mesh(lg, 'edGauge_label'); if (m) m.renderOrder = 3;
    }
  }
  bowl.mesh(grp, matFor('bowl')); symC.mesh(grp, matFor('symbol'));
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
  material: k => (k === 'faces' ? facesMaterial() : k === 'ao' ? aoMaterial()
                  : k === 'label' ? labelMaterial() : matFor(k)),
  holes: holesIn,                              // G279: the plate's cut-outs, in a parent's frame
  atlas: () => atlasCv, last: () => LAST, faceDim,
  switches: true,                // the light layer leaves the switch row to us
};

})();
