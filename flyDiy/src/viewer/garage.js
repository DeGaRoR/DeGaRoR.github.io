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

  // ---- body: a swept trim band down each side ----
  // u = angle around the section (0 top, .25 +z side, .5 belly, .75 -z side),
  // and v = station along the body, so a band that moves in u as v grows is a
  // stripe that sweeps up towards the tail. That one shape is most of what
  // makes a light aeroplane look painted rather than primed.
  const band = (uc0, uc1, halfW) => {
    g.beginPath();
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t * t;
      g.lineTo((u + halfW) * S, bodyBot + (bodyTop - bodyBot) * t);
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N, u = uc0 + (uc1 - uc0) * t * t;
      g.lineTo((u - halfW) * S, bodyBot + (bodyTop - bodyBot) * t);
    }
    g.closePath(); g.fill();
  };
  g.fillStyle = hex(P.trim);
  // u 0.33 is just BELOW the cabin glazing (which ends at 1.86 rad ≈ u 0.30),
  // so the stripe runs under the windows instead of across them
  const sweep = 0.10 * P.sweep;
  band(0.33, 0.33 - sweep, 0.045);
  band(0.67, 0.67 + sweep, 0.045);
  // belly a shade darker: aeroplanes are, and it reads as form from below
  g.fillStyle = mix(P.base, 0x000000, 0.16);
  g.fillRect(0.44 * S, bodyTop, 0.12 * S, bodyBot - bodyTop);

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
    const d = String(s.wing.naca | 0).padStart(4, '0');
    return which === 'm' ? +d[0] : +d.slice(2);
  };
  const nacaSet = (s, which, v) => {
    const d = String(s.wing.naca | 0).padStart(4, '0');
    s.wing.naca = which === 'm' ? (v * 1000 + +d.slice(1))
                                : (+d.slice(0, 2) * 100 + v);
  };

  const SLIDERS = [
    { p: 'wing.span',      L: 'Span',        min: 7,   max: 13,  st: 0.1,  u: ' m' },
    { p: 'wing.chord',     L: 'Chord',       min: 1.2, max: 2.0, st: 0.05, u: ' m' },
    { p: 'wing.dihedral',  L: 'Dihedral',    min: 0,   max: 6,   st: 0.5,  u: '°' },
    { p: 'wing.incidence', L: 'Incidence',   min: -1,  max: 4,   st: 0.1,  u: '°' },
    { p: '@camber',        L: 'Camber',      min: 0,   max: 6,   st: 1,    u: '%' },
    { p: '@thick',         L: 'Thickness',   min: 9,   max: 18,  st: 1,    u: '%' },
    { p: 'cab.h',          L: 'Cabin height', min: 0.8, max: 1.3, st: 0.02, u: ' m' },
    { p: 'fuse.crownTop',  L: 'Turtledeck',  min: 0,   max: 1,   st: 0.05, u: '' },
    { p: 'fuelL',          L: 'Fuel',        min: 0,   max: 120, st: 5,    u: ' l' },
  ];
  const readVal = (s, p) => p === '@camber' ? nacaGet(s, 'm')
                          : p === '@thick' ? nacaGet(s, 't') : get(s, p);
  const writeVal = (s, p, v) => p === '@camber' ? nacaSet(s, 'm', v)
                              : p === '@thick' ? nacaSet(s, 't', v) : set(s, p, v);

  let spec = api.defaults();
  const els = {};
  const row = (label, node, valNode) => {
    const d = document.createElement('div');
    d.className = 'grow';
    const l = document.createElement('span'); l.textContent = label;
    d.appendChild(l); d.appendChild(node);
    if (valNode) d.appendChild(valNode);
    rows.appendChild(d);
    return d;
  };
  const sel = (label, opts, value, on) => {
    const s = document.createElement('select');
    for (const [v, t] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = t; s.appendChild(o);
    }
    s.value = value;
    s.addEventListener('change', () => on(s.value));
    row(label, s);
    return s;
  };

  els.seating = sel('Seats', [['single', 'Single'], ['tandem2', 'Tandem 2'], ['side2', 'Side by side 2']],
    spec.seating, v => { spec.seating = v; rebuild(); });
  els.engine = sel('Engine', Object.keys(POWERPLANTS).map(k => [k, POWERPLANTS[k].engine.name]),
    spec.engine, v => { spec.engine = v; rebuild(); });
  els.material = sel('Structure', Object.keys(GEN_MATERIALS).map(k => [k, GEN_MATERIALS[k].name]),
    spec.material, v => { spec.material = v; rebuild(); });

  for (const S of SLIDERS) {
    const r = document.createElement('input');
    r.type = 'range'; r.min = S.min; r.max = S.max; r.step = S.st;
    r.value = readVal(spec, S.p);
    const b = document.createElement('b');
    b.textContent = (+r.value).toFixed(S.st < 1 ? 2 : 0) + S.u;
    r.addEventListener('input', () => {
      writeVal(spec, S.p, +r.value);
      b.textContent = (+r.value).toFixed(S.st < 1 ? 2 : 0) + S.u;
      queue();
    });
    row(S.L, r, b);
    els[S.p] = { r, b, S };
  }

  // paint: a few schemes rather than a colour picker — one tap, always legible
  const SCHEMES = [
    [0xf2c437, 0x1b3a5c], [0xe8e3d8, 0xb5342c], [0x2f6f52, 0xe8e3d8],
    [0xd8562e, 0x2a2724], [0x9fb3c8, 0x22304a],
  ];
  {
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
    row('Paint', wrap);
  }

  // ---- rebuild, debounced: a slider drag would otherwise regenerate the
  // structure, re-trim it in the tunnel and re-upload the mesh every pixel ----
  let timer = 0;
  const queue = () => { clearTimeout(timer); timer = setTimeout(rebuild, 140); };
  function rebuild() {
    clearTimeout(timer);
    api.apply(spec);
    // clampSpec may have pulled a value back inside the envelope (span is tied
    // to chord); show what was actually built, not what was asked for
    const built = api.resolved();
    if (built) {
      for (const S of SLIDERS) {
        const e = els[S.p]; if (!e) continue;
        const v = readVal(built, S.p);
        if (Math.abs(+e.r.value - v) > 1e-9) {
          e.r.value = v;
          e.b.textContent = (+v).toFixed(S.st < 1 ? 2 : 0) + S.u;
          writeVal(spec, S.p, v);
        }
      }
    }
    report();
  }

  function report() {
    const s = api.shake(), b = api.resolved();
    if (!s || !b) { read.innerHTML = ''; return; }
    const n = (v, d) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d == null ? 1 : d);
    const flag = (ok, warn) => ok ? 'ok' : (warn ? 'warn' : 'bad');
    const smOK = s.staticMargin > 0.05 && s.staticMargin < 0.35;
    const cell = (k, v, cls) => `<div class="gc ${cls || ''}"><span>${k}</span><b>${v}</b></div>`;
    read.innerHTML =
      `<h3>Shakedown</h3><div class="ggrid">` +
      cell('all-up', n(s.mass, 0) + ' kg') +
      cell('wing', n(s.Sw) + ' m²') +
      cell('loading', n(s.wingLoad) + ' kg/m²') +
      cell('stall', n(s.Vs * 3.6, 0) + ' km/h') +
      cell('cruise', n(s.VCruise * 3.6, 0) + ' km/h') +
      cell('L/D', n(s.LD, 1)) +
      cell('static margin', n(s.staticMargin * 100) + '%', flag(smOK)) +
      cell('cruise power', n(s.thrCruise * 100, 0) + '%', flag(s.thrCruise < 0.85, s.thrCruise < 0.95)) +
      cell('take-off run', n(s.TORun, 0) + ' m') +
      cell('3-point', n(s.deckAngle) + '°', flag(s.deckAngle > 8 && s.deckAngle < 15)) +
      cell('prop clear', n(s.propClear, 2) + ' m', flag(s.propClear > 0.20)) +
      `</div>` +
      // AUTO is per FIELD, from resolveSpec's own record of what it filled in —
      // a field the player has overridden must stop claiming to be derived
      `<h3>Shape</h3><div class="ggrid">` +
      ((k, A) => k('stab', n(b.tail.hSpan) + ' × ' + n(b.tail.hChord, 2) + ' m', A('tail.hSpan')) +
                 k('fin', n(b.tail.vHeight) + ' × ' + n(b.tail.vChord, 2) + ' m', A('tail.vHeight')) +
                 k('tail arm', n(b.fuse.tailArm) + ' m', A('fuse.tailArm')) +
                 k('gear track', n(b.gear.track) + ' m', A('gear.track')) +
                 k('main axle', n(b.gear.x, 2) + ' m aft', A('gear.x')) +
                 k('aspect ratio', n(b.geom.AR, 2), '')
      )(cell, f => (b._auto && b._auto[f]) ? 'auto' : '') +
      `</div><p class="gnote">italic = derived for you; set it yourself and it stops.</p>`;
  }

  // the panel only makes sense while the garage build is selected
  const acSel = $('selAc');
  const sync = () => {
    const on = api.isGen();
    host.style.display = on ? '' : 'none';
    if (on) report();
  };
  if (acSel) acSel.addEventListener('change', () => setTimeout(sync, 0));
  const close = $('gClose');
  if (close) close.addEventListener('click', () => { host.style.display = 'none'; });
  sync();
}
