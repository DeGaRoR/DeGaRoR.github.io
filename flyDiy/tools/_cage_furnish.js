// THE FURNISHING COLUMN (G2806, AVIONICS-GPS phase 2; futureDesigns/AVIONICS-STATUS-2026-10.md §1F, §4.3).
//
// The user, 11 Oct: "cabin furnishing (seats, panel, trim) is accounted accurately in mass", billed as its own row.
// This column owns `spec.outfit` the way _cage_panel.js owns `spec.systems`: a view of the section, a column the
// part tree opens (Cabin fit > Furnishing, `panel: 'CAGE_FURNISH'`), the commit through GARAGE_SPEC, and the join's
// seam (`toSpec`). It draws nothing: the seats it names are the crew layer's, and the bill is the ledger's own
// `furnish` row (61_gen_frame), read off the aeroplane the garage built - never a second sum here.
//
//   seats  GEN_SEATS (tube and sling / moulded pan / upholstered / energy-absorbing), each priced and weighed per
//          chair. WHAT YOU SEE: a pick here also sets the drawn seat (the crew's `seatType`: a sling is the tube
//          frame, a pan or a crushable seat the composite shell, an upholstered one the airliner seat); a build whose
//          drawn seat and billed kind disagree (a save from before this column) is said, and left as it is.
//   trim   GEN_TRIM (bare / light / lined / lined and quiet), the fraction of Raymer's furnishings law - or unset,
//          the panel tier's fraction exactly as every save before this column billed it (genFurnK).
//
// Load order: after _cage_panel.js (build.js MANIFEST.editor, _cage8.html, _parts_check.js - the three lists).
// Node-loadable with no document (GATE PARTS): nothing touches the DOM at load.
(() => {
const HAS_DOM = typeof document !== 'undefined';
const inGame = () => !!window.CAGE_IN_GAME;
const SEATS = () => (typeof GEN_SEATS !== 'undefined' ? GEN_SEATS : null);
const TRIM = () => (typeof GEN_TRIM !== 'undefined' ? GEN_TRIM : null);

// THE STATE - a view of spec.outfit. `trim` null = unset (the tier's).
const OF = { seats: 'sling', trim: null };
let seeded = false;
// the drawn seat (the crew's seatType) a kind is drawn as
const DRAWN = { sling: 0, basic: 1, standard: 2, energy: 1 };
const DRAWN_NAME = ['tube frame', 'composite shell', 'airliner seat'];

function fromSpec(o) {
  const s = (o && typeof o === 'object') ? o : {};
  const SE = SEATS(), TR = TRIM();
  OF.seats = (typeof s.seats === 'string' && (!SE || SE[s.seats])) ? s.seats : 'sling';
  OF.trim = (typeof s.trim === 'string' && (!TR || TR[s.trim])) ? s.trim : null;
  seeded = true;
  if (body) render();
}
// (in the game, from the garage's spec; elsewhere - the bench, a headless join - the column stays UNSEEDED until a
// spec or a hand gives it an answer, and an unseeded column writes nothing: a save's own seats are never replaced
// by this column's defaults)
function seed() {
  if (seeded) return;
  if (inGame() && window.GARAGE_SPEC && window.GARAGE_SPEC.get) {
    try { fromSpec(window.GARAGE_SPEC.get().outfit); } catch (e) {}
  }
}
// the join's seam: the trim only when one was chosen (an unset row writes no key); null when unseeded
function toSpec() {
  if (!seeded) seed();
  if (!seeded) return null;
  const o = { seats: OF.seats };
  if (OF.trim) o.trim = OF.trim;
  return o;
}
// COMMIT - the spec is the owner. The trim goes as written, null included: back to unset clears a choice.
function commit() {
  const G = window.GARAGE_SPEC;
  if (inGame() && G && G.update) {
    try { G.update({ outfit: { seats: OF.seats, trim: OF.trim } }); } catch (e) { console.error('furnishing:', e); }
  }
  if (window.CAGE_UI && window.CAGE_UI.build) try { window.CAGE_UI.build(); } catch (e) {}
}
// the seat a pick draws (the crew's row, through the editor's one door for an outside write)
function drawSeat(kind) {
  const U = window.CAGE_UI;
  if (!U || !U.P || DRAWN[kind] == null) return;
  if (Math.round(+U.P.seatType || 0) === DRAWN[kind]) return;
  if (U.setParam) U.setParam('seatType', DRAWN[kind]); else U.P.seatType = DRAWN[kind];
  if (typeof U.syncSliders === 'function') try { U.syncSliders(); } catch (e) {}
}

// THE COLUMN (the Instruments column's look: the same rows, selects and folds - the editor's --ed classes)
let wrap = null, body = null;
const el = (tag, cls, txt) => { const d = document.createElement(tag); if (cls) d.className = cls; if (txt != null) d.textContent = txt; return d; };
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
    if (v === String(value == null ? '' : value)) o.selected = true;
    s.appendChild(o);
  }
  s.onchange = () => onchange(s.value);
  d.appendChild(s);
  return s;
}
const fmtKg = x => (x >= 10 ? x.toFixed(1) : x.toFixed(2)) + ' kg';
const fmtCr = x => Math.round(x).toLocaleString('en') + ' cr';
function panelElement() {
  if (!HAS_DOM) return null;
  if (!wrap) {
    wrap = el('div', 'edRoot');
    const det = document.createElement('details');
    det.dataset.g = 'furnishing'; det.open = true;
    body = el('div');
    det.appendChild(body);
    wrap.appendChild(det);
  }
  render();
  return wrap;
}
function render() {
  if (!body) return;
  if (!seeded) seed();
  const SE = SEATS(), TR = TRIM();
  body.innerHTML = '';
  if (!SE || !TR) { body.appendChild(el('div', 'r', 'the core (flight_core.js) is not loaded - no catalogue')); return; }
  // ---- the seats
  select(body, 'seats', 'the kind of chair at every seat, priced and weighed per chair; a pick also draws it',
    Object.keys(SE).map(k => [k, SE[k].name + ' · ' + fmtKg(SE[k].kg) + ' · ' + fmtCr(SE[k].price) + ' each']),
    OF.seats, v => { OF.seats = v; seeded = true; drawSeat(v); render(); commit(); });
  const U = window.CAGE_UI, P = U && U.P;
  if (P && P.seatType != null && Math.round(+P.seatType) !== DRAWN[OF.seats]) {
    const d = row(body, 'drawn', 'the seat the cabin draws (the crew\'s seat type) is not the kind billed');
    const want = Object.keys(DRAWN).find(k => DRAWN[k] === Math.round(+P.seatType));
    const v = el('span', 'v', 'a ' + DRAWN_NAME[Math.round(+P.seatType)] + ', billed as ' + SE[OF.seats].name.toLowerCase() +
      (want ? ' - pick ' + SE[want].name + ' to bill what is drawn' : ''));
    v.style.color = '#e08a5a';
    d.appendChild(v);
  }
  // ---- the trim
  let tierName = 'the panel tier', tierK = null;
  try {
    const R = window.CAGE_PANEL && window.CAGE_PANEL.resolve ? window.CAGE_PANEL.resolve() : null;
    if (R && typeof GEN_OUTFIT !== 'undefined') { tierName = R.tier; tierK = GEN_OUTFIT.furnK[R.tier] || 0; }
  } catch (e) {}
  const opts = [['', 'as the panel tier (' + tierName + (tierK != null ? ': ' + Math.round(tierK * 100) + ' %' : '') + ')']]
    .concat(Object.keys(TR).map(k => [k, TR[k].name + ' · ' + Math.round(TR[k].k * 100) + ' %']));
  select(body, 'trim', Object.keys(TR).map(k => TR[k].name + ': ' + TR[k].note).join('\n') +
    '\n(a share of the GA furnishings law on the design gross; billed, not drawn - no headliner or carpet mesh yet)',
    opts, OF.trim || '', v => { OF.trim = v || null; seeded = true; render(); commit(); });
  // ---- the bill: the ledger's own furnish row, off the aeroplane the garage built
  let L = null;
  try { L = window.GARAGE_SPEC && window.GARAGE_SPEC.ledger ? window.GARAGE_SPEC.ledger() : null; } catch (e) {}
  const F = L && L.furnish;
  const d = row(body, 'billed', 'the ledger\'s furnishing row: the chairs and the lining, in the empty weight and the price');
  d.appendChild(el('span', 'v', F ? fmtKg(F.mass) + ' · ' + fmtCr(F.cost) : '…'));
}
// the bill lands after the rebuild a commit triggers: a built aeroplane re-renders the column
if (HAS_DOM && typeof window.addEventListener === 'function')
  window.addEventListener('flydiy:specUpdated', () => { if (body) setTimeout(() => { try { render(); } catch (e) {} }, 0); });

window.CAGE_FURNISH = {
  panel: panelElement,
  fromSpec, toSpec, state: () => OF, DRAWN,
  render: () => { if (body) render(); },
};
})();
