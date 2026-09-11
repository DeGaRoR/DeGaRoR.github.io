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
// SESSION 3 gives this layer its geometry: the dials, the drums, the
// switches and the key as `edGauge_*` moving groups on the dash face, the
// painted faces, the material factory. Until then _cage_crew.js's buildPanel
// keeps drawing the resolved list (panelItems), so the dash already shows
// what this column buys.
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

window.CAGE_PANEL = {
  panel: panelElement,
  fromSpec, toSpec, resolve, state: () => SY,
  render: () => { if (panelBody) renderPanel(); },
};

})();
