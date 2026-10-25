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
//          frame, a pan or a crushable seat the composite shell, an upholstered one the airliner seat); G2809: the
//          kind BILLED is always the drawn seat's (a shell is a pan, or the crushable seat when that is the pick).
//   trim   GEN_TRIM (bare / light / lined / lined and quiet): G2809, the FINISH of what the cabin draws - the pads
//          on the sill shoulders, the door panels and the console, the floor's covering; unset is light.
// G2809 (the user, 25 Oct: "Wysiwyg, and as billed for all"): the join writes what is drawn, always - the seats'
// kind off the drawn seat, the drawn surfaces (m2, measured here off the cage's sheets and the crew's floor and
// console) and the control stations; the ledger bills those (61_gen_frame, genDrawnCabin).
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
// THE DRAWN FURNISHING (G2809, the user of 25 Oct: "Wysiwyg, and as billed for all"): measured off the build the
// editor just drew, so the ledger bills what is there - the cage's own sheets by material (the dash shell, its facia,
// the sill shoulders, the door panels: m2, through the editor's metre scale) at the end of the post chain, and the
// crew layer's floor and console (its own record, read when the join asks: the floor lands after the chain)
let SHEETS = null;
const SHEET_OF = { dash: 'dash', dashFace: 'board', shoulder: 'shoulder', doorPanel: 'door' };
function measureSheets(ctx) {
  const m = ctx && ctx.mesh, P = ctx && ctx.P;
  if (!m || !m.V || !m.F) return null;
  const FS = ((window.CAGE2 && window.CAGE2.CAGE_UNIT) || 1) * ((P && P.planeScale) || 1);
  const V = m.V, out = { board: 0, dash: 0, shoulder: 0, door: 0 };
  for (const f of m.F) {
    const k = SHEET_OF[f.m];
    if (!k || !f.v || f.v.length < 3) continue;
    const p0 = V[f.v[0]];
    for (let i = 1; i + 1 < f.v.length; i++) {
      const p1 = V[f.v[i]], p2 = V[f.v[i + 1]];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
      out[k] += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) * FS * FS;
    }
  }
  return out;
}
{
  const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
  const prevPost = PAGE.post;
  PAGE.post = ctx => {
    if (prevPost) prevPost(ctx);
    try { SHEETS = measureSheets(ctx); } catch (e) { SHEETS = null; }
  };
}
// the control stations the crew drew (a stick, a yoke or a side stick each) and their kind (the crew's ctlStick)
const CTL_KIND = ['stick', 'yoke', 'side', 'none'];
function controls(P) {
  const mv = (window.CAGE_CREW && window.CAGE_CREW.moving) || [];
  const stations = mv.filter(m => /^edCtl_(stick|yoke|sideStick)(#\d+)?$/.test(m.name)).length;
  return { stations, kind: CTL_KIND[Math.round(+((P && P.ctlStick) || 0))] || 'stick' };
}
const r4 = x => +(+x || 0).toFixed(4);
// the kind billed for the seat DRAWN (the crew's seatType): a tube frame is a sling, a shell a moulded pan (or the
// energy-absorbing seat when that is the column's pick - the same shell drawn), an airliner seat upholstered
function billedKind(P) {
  const t = Math.round(+((P && P.seatType) || 0));
  return t === 2 ? 'standard' : t === 1 ? (OF.seats === 'energy' ? 'energy' : 'basic') : 'sling';
}
// THE JOIN'S SEAM: what is drawn, always (G2809) - the seats' kind off the drawn seat, the drawn areas, the control
// stations; the trim (the finish of the drawn pads and floor covering) only when one was chosen, so a save that
// never chose keeps its own
function toSpec() {
  if (!seeded) seed();
  const P = window.CAGE_UI && window.CAGE_UI.P;
  const o = { seats: billedKind(P) };
  if (seeded && OF.trim) o.trim = OF.trim;
  const S = SHEETS || {}, CR = window.CAGE_CREW || {};
  o.drawn = { board: r4(S.board), dash: r4(S.dash), shoulder: r4(S.shoulder), door: r4(S.door),
              floor: r4(CR.floor && CR.floor.areaM2), console: r4(CR.consoleM2) };
  o.ctl = controls(P);
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
    // (G2809: the select shows the kind BILLED - the drawn seat's; a pick draws its seat)
    (window.CAGE_UI && window.CAGE_UI.P) ? billedKind(window.CAGE_UI.P) : OF.seats,
    v => { OF.seats = v; seeded = true; drawSeat(v); render(); commit(); });
  const U = window.CAGE_UI, P = U && U.P;
  // G2809: the kind billed is the seat DRAWN (a pick above draws it; the crew's seat type draws it too)
  if (P && P.seatType != null) {
    const kind = billedKind(P);
    const d = row(body, 'drawn', 'the seat the cabin draws (the crew\'s seat type) - the kind the ledger bills, at every seat drawn');
    d.appendChild(el('span', 'v', 'a ' + DRAWN_NAME[Math.round(+P.seatType)] + ' · billed as ' + SE[kind].name.toLowerCase()));
  }
  // ---- the trim: the finish of the drawn pads and floor covering (G2809)
  const opts = [['', 'light (unset)']].concat(Object.keys(TR).map(k => [k, TR[k].name + ' · pads ' + TR[k].pad + ' kg/m² · cover ' + TR[k].cover + ' kg/m²']));
  select(body, 'trim', Object.keys(TR).map(k => TR[k].name + ': ' + TR[k].note).join('\n') +
    '\n(the finish of what the cabin draws: the sill shoulders, the door panels, the console and the floor\'s covering)',
    opts, OF.trim || '', v => { OF.trim = v || null; seeded = true; render(); commit(); });
  // ---- what the cabin draws, as the ledger bills it (G2809)
  {
    const o = toSpec(), D = o.drawn || {}, T = TR[OF.trim || 'light'] || TR.light;
    const O = typeof GEN_OUTFIT !== 'undefined' ? GEN_OUTFIT : null;
    const line = (label, title, m2, kgM2) => {
      if (!(m2 > 0)) return;
      const d = row(body, label, title);
      d.appendChild(el('span', 'v', m2.toFixed(2) + ' m² · ' + fmtKg(m2 * kgM2)));
    };
    if (O) {
      line('panel board', 'the instrument facia as drawn, an alloy board', D.board, O.panelKgM2);
      line('dash shell', 'the coaming and glareshield round it, a moulded shell', D.dash, O.dashShellKgM2);
      line('sill shoulders', 'the pads on the sill shoulders, at the trim\'s density', D.shoulder, T.pad);
      line('door panels', 'the door panels, at the trim\'s density', D.door, T.pad);
      line('console', 'the centre console box, at the trim\'s density', D.console, T.pad);
      line('floor', 'the floor board (ply) under the trim\'s covering', D.floor, O.floorPlyKgM2 + T.cover);
      const c = o.ctl;
      if (c) {
        const d = row(body, 'controls', 'the control stations the cabin draws: each past the first is a second set; a yoke\'s column weighs more than a stick');
        d.appendChild(el('span', 'v', c.stations + ' station' + (c.stations === 1 ? '' : 's') + ' · ' + c.kind));
      }
    }
  }
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
