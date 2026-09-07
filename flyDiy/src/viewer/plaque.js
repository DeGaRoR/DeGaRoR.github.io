// ============================================================
// THE PLAQUE'S SHEET (G208) — how a measured number is shown.
//
// The user, 2026-09-07: "Right now, there are titles cut with no tooltip,
// I have no idea what they mean." The plaque was a two-column grid in
// app.js; a label that did not fit its half took an ellipsis, and only the
// rows that happened to have a WHY entry carried a native title. So:
//
//   ONE column. A label is never clipped; a long value wraps under it.
//   EVERY row explains itself. `what` is mandatory here — a row app.js
//     prints under a label this table does not know is a bug the gate
//     catches (GATE BENCH), not a silent grey number.
//   A HOVER CARD, not a native title: it opens at once, it wraps, and a
//     click pins the explanation under the row for touch and for reading.
//   A BAND BAR on every judged row: where the value sits between bad, warn
//     and ok, so a number is read against its bound without arithmetic.
//   EVERY section says what it groups, in one dim line under its heading.
//
// The thresholds are unchanged and still the code's own — this file only
// moved them out of app.js so the plaque could be drawn by something that
// is not also the game's main loop. app.js builds the sheet through
// `PLAQUE.sheet()`; the colours, the bounds and the explanations live here.
// ============================================================

// WHY A ROW IS RED, AND WHAT TO TURN — keyed on the row's own label so the
// pointers live in one place. `what` is shown always; `fix` only when the
// row is warn or bad. Both name the CONTROLS a builder has.
const PLAQUE_WHY = {
  // weights
  'empty': { what: 'the aeroplane with nothing and nobody aboard: structure, '
      + 'covering, engine, propeller, undercarriage, tanks or cells, and every '
      + 'fitting you switched on.' },
  'payload': { what: 'what it carries as drawn — the crew you switched on, '
      + 'the fuel you specified, and any baggage.' },
  'all-up': { what: 'empty weight plus payload: the mass every other number '
      + 'on this plaque was measured at.' },
  'cost': { what: 'the bill, in the workshop’s own units, for the parts '
      + 'and the covering as built. It buys nothing here; it is how two '
      + 'builds compare.' },
  // wing
  'area': { what: 'the wing area — both wings of a biplane — that the loading '
      + 'and the stall speed are computed on.' },
  'loading': { what: 'all-up mass over wing area. A trainer sits near 40 '
      + 'kg/m², an ultralight under 25, a fast tourer past 80; higher '
      + 'means a faster stall and a longer field.' },
  'aspect': { what: 'span squared over area. Long and narrow (high aspect) '
      + 'glides better and climbs better for the same power; short and wide '
      + 'rolls faster and is stronger for its weight.' },
  'best L/D': { what: 'the glide ratio - metres forward per metre down, at '
      + 'the speed it is best, which is printed with it. Real light '
      + 'aeroplanes sit at 8-12, an open-frame ultralight nearer 6-8, a '
      + 'glider 25 and up.',
    fix: 'on a light aeroplane this is PARASITE drag first: cover the '
      + 'fuselage, put spats on the wheels, fair the legs and the struts. '
      + 'Span and a narrower chord help after that. Exposed engines, '
      + 'radiators and an open truss are what an ultralight pays for.' },
  'L/D at cruise': { what: 'lift over drag at the cruise speed the power '
      + 'curve sets (65% of the thrust available). More power buys a '
      + 'faster cruise, and a faster cruise sits further from the best '
      + 'glide - so this number FALLS when you add an engine, and the '
      + 'wing barely moves it.' },
  // speeds & field
  'stall': { what: 'the slowest it flies level at this mass, wings clean. '
      + 'Approach is flown at about 1.3 times this; the landing run and the '
      + 'field length both follow it.' },
  'cruise': { what: 'the speed the power curve settles at with the engine at '
      + 'about 65% of full throttle — what you would actually fly it at.' },
  'climb': { what: 'best rate of climb at sea level, at full power.',
    fix: 'this is power against weight: a bigger engine, a coarser propeller, '
      + 'less structure, or more wing area. Check the empty weight first - '
      + 'covering and fittings add up faster than they look.' },
  'take-off run': { what: 'ground roll plus the climb to the 15 m screen.',
    fix: 'more power or less weight shortens it; so does more wing area and a '
      + 'flap that actually lifts (a plain flap does little). A fine-pitch '
      + 'propeller helps here and costs you cruise speed.' },
  // in thin air
  'density altitude': { what: 'the height in the standard atmosphere whose '
      + 'air is as thin as the hot mountain strip’s: the one number the '
      + 'engine and the wing both feel.' },
  'take-off there': { what: 'the same run at the hot-and-high field.',
    fix: 'thin air takes power and lift together. A normally aspirated engine '
      + 'loses roughly 3% per 300 m of density altitude, so the levers are '
      + 'installed power and weight, in that order.' },
  'climb there': { what: 'rate of climb at the hot-and-high field.',
    fix: 'the same lever as climb but less forgiving - at density altitude '
      + 'the margin is small, so weight comes off before power goes on.' },
  'power there': { what: 'the fraction of sea-level power the engine still makes.',
    fix: 'a normally aspirated engine cannot avoid this. A turbocharged or an '
      + 'electric powerplant holds its output far better with height, and a '
      + 'flat-rated turbine keeps its full rating to a density altitude.' },
  'service ceiling': { what: 'the height at which climb falls to 0.5 m/s.',
    fix: 'power against weight again, and wing area. A low ceiling and a poor '
      + 'climb are the same problem read twice.' },
  'absolute ceiling': { what: 'the height at which it stops climbing '
      + 'altogether. "Above" means the model stopped looking, not that the '
      + 'aeroplane kept going.' },
  // on the test flight
  'outcome': { what: 'whether the test pilot completed the circuit.',
    fix: 'read the pilot notes below - the circuit stopped somewhere, and the '
      + 'phase it stopped in names the problem.' },
  'landing run': { what: 'roll from touchdown to a stop.',
    fix: 'a lower stall speed is almost the whole of it - more wing area, or '
      + 'a flap that lifts. The approach speed follows the stall.' },
  'touchdown': { what: 'sink rate and speed at the moment the wheels arrive.',
    fix: 'a firm arrival is usually approach speed or the flare. More wing '
      + 'area lowers both; softer gear absorbs what is left.' },
  'past the aim': { what: 'how far beyond the aiming point it touched down.',
    fix: 'floating means too much speed on the approach for the drag '
      + 'available; a flap that adds drag as well as lift settles it.' },
  'crosswind limit': { what: 'the strongest crosswind in which the test '
      + 'pilot keeps the take-off roll between the strip\'s edge lines; the '
      + 'heading as the wheels leave is shown beside it.',
    fix: 'a taildragger with its CG far behind the mains swings harder, and '
      + 'a high thrust line lifts the tail before the rudder has the air to '
      + 'hold it: mains further aft, a bigger fin, or a lower thrust line. '
      + 'No pilot gain moves this number (HANDOVER G193.1).' },
  'test card': { what: 'the height and speed the bench asked the pilot to '
      + 'hold on the cruise leg. Blank fields mean the standard circuit.' },
  'held': { what: 'what the pilot actually flew on the cruise leg, against '
      + 'what the test card asked for.',
    fix: 'the aeroplane could not hold the ask. Speed short is drag or power; '
      + 'height short is climb.' },
  'trim flown': { what: 'the elevator the pilot held on the settled cruise '
      + 'leg, as trim clicks — the setting the advisor recommends for your '
      + 'own hand.' },
  'pilot notes': { what: 'bounded verdicts the test pilot recorded in flight.',
    fix: 'each code names one thing it did not like - the newest is shown.' },
  // powerplant
  'full-throttle draw': { what: 'electrical power the motor pulls at full '
      + 'throttle. Divide the pack into it for the full-power endurance.' },
  'full-throttle burn': { what: 'fuel the engine burns at full throttle, by '
      + 'mass and by volume. Cruise burns about two thirds of it.' },
  'cooling duty': { what: 'the heat the engine sheds at full power and what '
      + 'carries it away. A cowl has to swallow this.' },
  // balance
  'CG': { what: 'where the centre of gravity sits along the aeroplane, '
      + 'measured from the datum, as drawn.' },
  'neutral pt': { what: 'the point the CG must stay ahead of for the '
      + 'aeroplane to return to trim on its own. Wing area, tail area and '
      + 'tail arm set it.' },
  'static margin': { what: 'how far the centre of gravity sits ahead of the '
      + 'neutral point, as a fraction of the mean chord, with the aeroplane '
      + 'loaded exactly as it stands. Positive means it returns to trim by '
      + 'itself; the fleet sits near 0.20.',
    fix: 'move mass FORWARD (the engine, the tanks, the seats) or move the '
      + 'wing AFT. A longer tail arm carries the neutral point back and '
      + 'helps both. Negative is unflyable, not merely twitchy.' },
  'CG as loaded': { what: 'the CG as a fraction of the mean chord behind the '
      + 'leading edge — the way a real weight-and-balance sheet quotes it. '
      + 'Light aeroplanes publish ranges like 17 to 36 % MAC.' },
  'weathervane': { what: 'directional stiffness (Cn_beta) - how hard the '
      + 'aeroplane points itself back into the airflow. The Cub reads 0.11.',
    fix: 'fin AREA and fin HEIGHT both move it, and so does a longer tail '
      + 'arm. Under 0.03 it wanders; negative and it swaps ends.' },
  // on the ground
  'stands on': { what: 'what the aeroplane is actually resting on, measured '
      + 'rather than assumed.',
    fix: 'if it is not on its wheels the undercarriage geometry is wrong - '
      + 'leg length, rake, and where the mains sit relative to the CG.' },
  'deck angle': { what: 'the nose-up angle it sits at on its wheels. A '
      + 'taildragger sits 8-12° and lifts its tail to see; a tricycle '
      + 'sits near level.' },
  'fuel': { what: 'the fuel it burns; the density sets what a litre weighs.' },
  'cells': { what: 'the cell chemistry the pack is built from; it sets what a '
      + 'kilowatt-hour weighs.' },
  'fuel aboard': { what: 'the fuel mass at the fill you specified. It is '
      + 'payload, and it burns off in flight.' },
  'cell mass': { what: 'the pack’s cells. Unlike fuel they weigh the same '
      + 'empty as full, so they count as empty weight.' },
  'room needed': { what: 'the volume the fuel or the cells take, which the '
      + 'bays below have to find.' },
  'propeller pitch': { what: 'fine pitch climbs and takes off short, coarse '
      + 'pitch cruises fast; "chosen for you" means the garage picked it for '
      + 'this engine and this wing.' },
  'prop clear': { what: 'propeller tip to the ground in the resting attitude.',
    fix: 'longer undercarriage legs, a smaller propeller disc, or raise the '
      + 'thrust line. Under 0.05 m it strikes on any soft field.' },
  'nose-over': { what: 'the angle from the mains to the CG - how hard you can '
      + 'brake before it goes on its nose.',
    fix: 'move the main wheels FORWARD, or the CG aft. Under 15 degrees is a '
      + 'taildragger that will not forgive a firm brake.' },
  'power nose-over': { what: 'how close full power alone comes to lifting '
      + 'the tail over the mains on a taildragger with a high thrust line; '
      + 'at 1 it goes over with the brakes off.',
    fix: 'lower the thrust line, move the mains forward, or hold less than '
      + 'full throttle until the tail is up — the pilots already do.' },
  'gear': { what: 'the undercarriage as built.',
    fix: 'FOLDED means it collapsed under its own weight - the legs are too '
      + 'soft, or the aeroplane is too heavy for them.' },
};

// a bay row's label is the BAY's own name, so app.js hands its explanation
// over directly; this is the text it hands, kept beside the others
const PLAQUE_WHY_BAY = {
  what: 'what this vessel holds, against the room the bay actually has.',
  fix: 'move it to a larger bay, split it across two, or ask for less '
     + 'capacity. A wing bay grows with span and chord; a body bay '
     + 'grows with the cabin length and the fuselage section.' };

// the vessel row's label is the vessel's own name (a welded tank, a pack)
const PLAQUE_WHY_VESSEL = {
  what: 'the tank or the pack itself, as a thing you bought: its own mass, '
     + 'which is empty weight, named by how it is made.' };

// WHAT A SECTION GROUPS — one dim line under its heading. Keyed on the
// heading's text before any parenthesis, so 'at reserves (18 L)' reads the
// 'at reserves' entry.
const PLAQUE_SECTIONS = {
  'weights': 'what it weighs, empty and as loaded, and what it cost to build',
  'wing': 'the wing as an aerofoil: how much of it there is and how well it glides',
  'speeds & field': 'how slow it flies, how fast it cruises, and the field it needs at sea level',
  'in thin air': 'the same take-off and climb out of a hot mountain strip, from the density-altitude test',
  'on the test flight': 'what the test pilot found flying the circuit, from the test flight',
  'powerplant': 'what the engine burns and the heat it sheds at full throttle',
  'balance': 'where the centre of gravity sits against the neutral point, loaded as it stands',
  'at reserves': 'the same aeroplane with 15% fuel — lighter, and with its CG moved by the burn-off',
  'on the ground': 'how it sits on its wheels and what that allows',
  'fuel and tank': 'the fuel aboard, the tank it sits in, and whether the bay can take it',
  'the pack': 'the cells aboard, the pack they sit in, and whether the bay can take it',
};

// EVERY NUMBER SAYS WHAT IT IS JUDGED AGAINST (G179.4, the user: "all
// numbers should give their acceptable bounds. I don't know what I'm
// working against"). ONE table: the verdict colour, the printed bound and
// the band bar all read it, so they cannot disagree, and a row with no
// entry is information, not a judgement. `lo`/`hi` are the ok band's edges
// (warn past them, or bad when `badAtLo` says the band's edge is the red
// one); `badLo`/`badHi` the red edges; `text` is what the row prints.
const PLAQUE_BOUNDS = {
  'best L/D':        { lo: 6, text: '≥ 6' },
  'climb':           { lo: 0.5, badAtLo: true, text: '≥ 0.5 m/s' },
  'take-off run':    { hi: 500, badHi: 1100, text: '≤ 500 m' },
  'take-off there':  { hi: 500, badHi: 1100, text: '≤ 500 m' },
  'climb there':     { lo: 0.3, badAtLo: true, text: '≥ 0.3 m/s' },
  'power there':     { lo: 75, text: '≥ 75%' },
  'service ceiling': { lo: 500, text: '≥ 500 m' },
  'static margin':   { lo: 0.05, badLo: 0, text: '≥ 0.05' },
  'weathervane':     { lo: 0.03, badLo: 0, text: '≥ 0.03' },
  'prop clear':      { lo: 0.12, badLo: 0.05, text: '≥ 0.12 m' },
  'nose-over':       { lo: 15, text: '≥ 15°' },
  'power nose-over': { hi: 0.75, badHi: 1, text: '< 0.75' },
  'crosswind limit': { lo: 4, badLo: 2, text: '≥ 4 m/s' },
  'landing run':     { hi: 500, text: '≤ 500 m' },
  'touchdown':       { hi: 1.8, text: '≤ 1.8 m/s' },
};

function plaqueJudge(label, v) {
  const b = PLAQUE_BOUNDS[label];
  if (!b || v == null || !isFinite(v)) return '';
  if (b.badLo != null && v < b.badLo) return 'bad';
  if (b.badHi != null && v > b.badHi) return 'bad';
  if (b.lo != null && v < b.lo) return b.badAtLo ? 'bad' : 'warn';
  if (b.hi != null && v > b.hi) return 'warn';
  return '';
}

// THE BAND BAR: three thirds — bad, warn, ok (or ok, warn, bad for a
// row judged from above) — and the marker's place in them. A value inside a
// third is placed linearly across it; the ok third runs on to twice the
// bound (or half of it for a `hi` row) so a comfortable margin reads as
// comfortable and a value just over the line reads as just over. Pure, so
// GATE BENCH can prove the marker never leaves the bar.
function plaqueBandPos(b, v) {
  if (!b || v == null || !isFinite(v)) return null;
  const cl = (x, a, c) => Math.max(a, Math.min(c, x));
  if (b.lo != null) {
    // from below: bad | warn | ok, left to right
    const red = b.badAtLo ? null : (b.badLo != null ? b.badLo : null);
    const lo = b.lo;
    if (red == null) {
      // two zones: bad (or warn) below lo, ok above — the bar splits in half
      if (v < lo) return { pos: 0.5 * cl(v / lo, 0, 1) * 0.94, zone: b.badAtLo ? 'bad' : 'warn', order: 'up' };
      return { pos: 0.5 + 0.5 * cl((v - lo) / lo, 0, 1), zone: 'ok', order: 'up' };
    }
    if (v < red) return { pos: (1 / 3) * cl(v / Math.max(1e-9, red), -1, 1) * 0.5 + 1 / 6, zone: 'bad', order: 'up' };
    if (v < lo) return { pos: 1 / 3 + (1 / 3) * cl((v - red) / Math.max(1e-9, lo - red), 0, 1), zone: 'warn', order: 'up' };
    return { pos: 2 / 3 + (1 / 3) * cl((v - lo) / Math.max(1e-9, lo), 0, 1), zone: 'ok', order: 'up' };
  }
  if (b.hi != null) {
    // from above: ok | warn | bad, left to right
    const hi = b.hi, red = b.badHi;
    if (red == null) {
      if (v > hi) return { pos: 0.5 + 0.5 * cl((v - hi) / hi, 0, 1), zone: 'warn', order: 'down' };
      return { pos: 0.5 * cl(v / hi, 0, 1), zone: 'ok', order: 'down' };
    }
    if (v > red) return { pos: 2 / 3 + (1 / 3) * cl((v - red) / Math.max(1e-9, red), 0, 1), zone: 'bad', order: 'down' };
    if (v > hi) return { pos: 1 / 3 + (1 / 3) * cl((v - hi) / Math.max(1e-9, red - hi), 0, 1), zone: 'warn', order: 'down' };
    return { pos: (1 / 3) * cl(v / hi, 0, 1), zone: 'ok', order: 'down' };
  }
  return null;
}

const plaqueEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- THE SHEET -------------------------------------------------------
// app.js builds one per draw: H() opens a section, R() adds a row, mount()
// writes the DOM and wires the hover cards. The explanations are looked up
// here; a row app.js prints under a label nobody explained is recorded in
// `missing`, which is what the gate reads.
function plaqueSheet() {
  const rows = [], missing = [];
  let secN = 0;
  const H = title => {
    const key = String(title).replace(/\s*\(.*$/, '').trim();
    const what = PLAQUE_SECTIONS[key] || '';
    if (!what) missing.push('section ' + key);
    rows.push({ h: true, title, what });
    secN++;
  };
  // `why` may be a string, an object {what, fix}, or omitted (looked up)
  const R = (label, val, cls, why) => {
    const w = why !== undefined ? why : PLAQUE_WHY[label];
    if (!w) missing.push(label);
    const bnd = PLAQUE_BOUNDS[label];
    rows.push({ label, val: String(val), cls: cls || '', why: w || null, bnd });
  };
  // the value a band bar reads: app.js hands the raw number through `v`
  // when the printed value is a composite ('1.2 m/s · 82 km/h')
  const RV = (label, val, v, why) => {
    const cls = plaqueJudge(label, v);
    R(label, val, cls, why);
    rows[rows.length - 1].v = v;
  };
  function html() {
    const out = [];
    for (const r of rows) {
      if (r.h) {
        out.push('<div class="ph"><span>' + plaqueEsc(r.title) + '</span>' +
          (r.what ? '<em>' + plaqueEsc(r.what) + '</em>' : '') + '</div>');
        continue;
      }
      let tip = '';
      if (r.why) tip = typeof r.why === 'string' ? r.why
        : (r.why.what || '') + (r.cls && r.why.fix ? '\n→ ' + r.why.fix : '');
      if (r.bnd) tip += (tip ? '\n' : '') + 'judged against ' + r.bnd.text;
      const bp = r.bnd ? plaqueBandPos(r.bnd, r.v != null ? r.v : parseFloat(r.val)) : null;
      out.push('<div class="pr' + (r.cls ? ' ' + r.cls : '') + (tip ? ' has' : '') + '"' +
        (tip ? ' data-tip="' + plaqueEsc(tip) + '"' : '') + '>' +
        '<span class="pl">' + plaqueEsc(r.label) + '</span>' +
        '<b class="pv">' + r.val + (r.bnd ? ' <i>' + plaqueEsc(r.bnd.text) + '</i>' : '') + '</b>' +
        (bp ? '<div class="pb ' + bp.order + '"><i style="left:' +
              (bp.pos * 100).toFixed(1) + '%"></i></div>' : '') +
        '</div>');
    }
    return out.join('');
  }
  function mount(host) {
    if (!host) return;
    host.innerHTML = html();
    plaqueWireTips(host);
  }
  return { H, R, RV, judge: plaqueJudge, mount, html, rows, missing };
}

// ---- THE HOVER CARD ---------------------------------------------------
// One element for the page, made on first use. Hover opens it beside the
// row; a click pins the same text UNDER the row (touch has no hover, and a
// pinned explanation can be read while the slider moves). Guarded for the
// smoke test's stub DOM, where there is no layout to measure.
let plaqueTipEl = null;
function plaqueTip() {
  if (plaqueTipEl) return plaqueTipEl;
  try {
    plaqueTipEl = document.createElement('div');
    plaqueTipEl.id = 'pqTip';
    plaqueTipEl.hidden = true;
    document.body.appendChild(plaqueTipEl);
  } catch (e) { plaqueTipEl = null; }
  return plaqueTipEl;
}
function plaqueWireTips(host) {
  let els;
  try { els = host.querySelectorAll('.pr.has'); } catch (e) { return; }
  if (!els || !els.length) return;
  const tip = plaqueTip();
  els.forEach(el => {
    const text = el.dataset ? el.dataset.tip : el.getAttribute('data-tip');
    el.onmouseenter = () => {
      if (!tip) return;
      tip.textContent = text;
      tip.hidden = false;
      try {
        const r = el.getBoundingClientRect();
        const W = window.innerWidth || 1200, Hh = window.innerHeight || 800;
        // beside the panel, over the view: to the right of the row when the
        // panel sits at the left edge (the information panel does), to the
        // left when it sits at the right; under the row only when neither
        // side has room. Over the view, not over the neighbouring rows.
        tip.style.maxWidth = '280px';
        const tw = Math.min(280, W * 0.4);
        let x, y = r.top - 4;
        if (r.right + tw + 14 < W - 8) x = r.right + 14;
        else if (r.left - tw - 14 > 8) x = r.left - tw - 14;
        else { x = Math.max(8, r.left); y = r.bottom + 6; }
        if (y + 120 > Hh) y = Math.max(8, Hh - 130);
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      } catch (e) {}
    };
    el.onmouseleave = () => { if (tip) tip.hidden = true; };
    el.onclick = () => {
      let px = el.querySelector('.px');
      if (px) { px.remove(); el.classList.remove('open'); return; }
      px = document.createElement('div');
      px.className = 'px';
      px.textContent = text;
      el.appendChild(px);
      el.classList.add('open');
    };
  });
}

if (typeof window !== 'undefined')
  window.PLAQUE = { sheet: plaqueSheet, judge: plaqueJudge, bandPos: plaqueBandPos,
                    WHY: PLAQUE_WHY, WHY_BAY: PLAQUE_WHY_BAY, WHY_VESSEL: PLAQUE_WHY_VESSEL,
                    SECTIONS: PLAQUE_SECTIONS, BOUNDS: PLAQUE_BOUNDS };
if (typeof module !== 'undefined' && module.exports)
  module.exports = { plaqueSheet, plaqueJudge, plaqueBandPos, PLAQUE_WHY,
                     PLAQUE_WHY_BAY, PLAQUE_WHY_VESSEL, PLAQUE_SECTIONS, PLAQUE_BOUNDS };
