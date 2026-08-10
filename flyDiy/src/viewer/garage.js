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

function genPaintDataURI(spec) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const hex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');
  const mix = (a, b, t) => {
    const A = [(a>>16)&255, (a>>8)&255, a&255], Bc = [(b>>16)&255, (b>>8)&255, b&255];
    return hex(((A[0]+(Bc[0]-A[0])*t)|0)<<16 | ((A[1]+(Bc[1]-A[1])*t)|0)<<8 | ((A[2]+(Bc[2]-A[2])*t)|0));
  };
  const P = spec.paint;
  g.fillStyle = hex(P.base); g.fillRect(0, 0, S, S);

  // UV v runs bottom-up in a WebGL texture, so the BODY zone (v 0.03..0.47) is
  // the lower half of this canvas and the PANEL zone (v 0.53..0.97) the upper.
  const yOf = v => S * (1 - v);
  const bodyTop = yOf(0.47), bodyBot = yOf(0.03);
  const panTop = yOf(0.97), panBot = yOf(0.53);

  // ---- body: a thin cheat line down each side ----
  // u = angle around the section (0 top, .25 +z side, .5 belly, .75 -z side),
  // v = station along the body. A WIDE swept band was tried first and read as a
  // grey slab wrapped round the fuselage — on a flat-sided fabric aeroplane the
  // stripe that works is thin, straight and at the waterline.
  const band = (uc0, uc1, halfW) => {
    g.beginPath();
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t;
      g.lineTo((u + halfW) * S, bodyBot + (bodyTop - bodyBot) * t);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t;
      g.lineTo((u - halfW) * S, bodyBot + (bodyTop - bodyBot) * t);
    }
    g.closePath(); g.fill();
  };
  g.fillStyle = hex(P.trim);
  const sweep = 0.035 * P.sweep;
  band(0.30, 0.30 - sweep, 0.013);
  band(0.70, 0.70 + sweep, 0.013);
  // belly a shade darker: aeroplanes are, and it reads as form from below
  g.fillStyle = mix(P.base, 0x000000, 0.13);
  g.fillRect(0.435 * S, bodyTop, 0.13 * S, bodyBot - bodyTop);

  // ---- flying surfaces: leading edge, and a tip stripe ----
  // u is the chord fraction, walking TE -> LE -> TE, so the LE is u = 0.
  g.fillStyle = mix(P.base, 0x000000, 0.22);
  g.fillRect(0, panTop, 0.035 * S, panBot - panTop);
  g.fillStyle = hex(P.trim);
  g.fillRect(0, panTop, S, 0.055 * (panBot - panTop));      // tip band

  // ---- fabric: ribs and stringers run ACROSS the body in both zones, so one
  // set of faint lines serves the fuselage and the wing alike ----
  g.strokeStyle = 'rgba(0,0,0,.055)'; g.lineWidth = 1;
  for (let y = 0; y < S; y += 7) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(S, y + 0.5); g.stroke();
  }
  // registration, on both sides of the aft body (rotated: u is the canvas x)
  if (spec.reg) {
    g.save();
    g.fillStyle = mix(P.trim, 0x000000, 0.25);
    g.font = '600 26px "IBM Plex Sans", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const u of [0.25, 0.75]) {
      g.save();
      g.translate(u * S, bodyTop + 0.30 * (bodyBot - bodyTop));
      g.rotate(-Math.PI / 2);
      g.fillText(spec.reg, 0, 0);
      g.restore();
    }
    g.restore();
  }
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
