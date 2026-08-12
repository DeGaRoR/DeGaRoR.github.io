# TRANSFER SPEC — cabin, glazing & occupant into the garage editor

For a dev session that has the repo. Prototype and reference implementation live
in this project; **nothing was written to `flyDiy/`**.

The work is one theme: the generated aeroplane had no cabin. It now has an
opening cut in the covering, a canopy or windscreen over it, side lights, a
sunscreen roof, a coaming and instrument panel, seats, and an occupant — all
parametric, all bound to the same truss nodes the covering is bound to.

---

## 1. Files

| here | repo |
|---|---|
| `gen/63_gen_skin.js` | `src/core/63_gen_skin.js` |
| `gen/60_gen_spec.js` | `src/core/60_gen_spec.js` |
| `gen/garage.js` | `src/viewer/garage.js` — only the bakes changed; `garageInit` is byte-identical to the repo's |
| `gen/orig/*` | pristine copies of all four, for diffing |
| `plane-glazing.html` | the prototype harness. Not part of the artifact, but the fastest way to see any of this move, and the place to reproduce a report |
| `Garage Look Pass.dc.html` | the earlier before/after look pass (materials, textures, resolution) |

`61_gen_frame.js` is **unchanged**. No new nodes, no new beams, no mass, no
strips, no ledger entries. Everything added is covering.

### What to leave behind

**The propeller work is dismissed** (user call). Take the
`// ---- 5. wheels and propeller` block verbatim from
`gen/orig/63_gen_skin.js`, and delete the `spinner` and `proptip` entries from
the returned `mats`. Nothing else references them. The prop sliders in the
harness go with it.

---

## 2. Spec surface

All new fields are under `cabin`, except `fuselage.tailY` and `paint.regX`.
Every one is clamped in `clampSpec`; nullable ones (`genClampN`) mean "derive
it" and ride the panel's existing AUTO path.

### 2.1 Route

`cabin.glazing`: `'none' | 'windshield' | 'bubble' | 'greenhouse'`

`greenhouse` is kept only so old specs still load — it is now `facet: true` on a
`bubble`. `windshield` is the control case: zero stand-off, the covered surface
reproduced exactly.

`cabin.wingBay`: `'solid' | 'skylight' | 'open'` — what happens where a high
wing's centre section crosses the cabin roof.

### 2.2 Canopy shell — `cabin.canopy`

| field | range | default | what it does |
|---|---|---|---|
| `height` | 0 – 0.90 | **0** | rise above the body's own deck line. 0 = the fuselage face turns to glass and nothing protrudes |
| `width` | 0.85 – 1.60 | 1.0 | how far the section swells sideways past the sill |
| `bubble` | 0 – 1 | 0.70 | section fullness: 1 half-round blown, 0 flat-sided with a crown |
| `lid` | 0.25 – 1 | 1.0 | virtual clipping plane as a fraction of the rise. A wing inside the envelope lowers it further — the only thing a high wing does differently |
| `sill` | 0.10 – 0.85 | 0.30 | how far down the sides the opening cuts. **A height plane**, not a ring index — see §5 |
| `skew` | 0.20 – 1.60 | 0.42 | how much of the window's length the front rake takes |
| `x0` / `x1` | 0 – 8 / 0 – 9, nullable | null | window stations, m aft of the firewall. Null derives from the cabin, so the canopy follows the cabin sliders unless pinned. `x1` is the "reach" slider |
| `joint` | `'square' \| 'chamfer'` | square | the corner where the opening ends |
| `jointRun` | 1 – 8 | 3 | chamfer length, in ring indices |
| `facet` | bool | false | frame bars down every section edge instead of two rails |

### 2.3 Windscreen & sunscreen — `cabin.canopy`

| field | range | default | what it does |
|---|---|---|---|
| `wsAngle` | 22 – 80, nullable | null | windscreen rake, degrees. Drives `fuselage.windRun`, so the body's step and the canopy's front bow move together |
| `wsCurve` | 0 – 1 | 1 | how much the screen bows in plan |
| `sun` | 0 – 0.92 | 0 | opaque sunscreen roof, as a fraction of the arc from the crown down |
| `sunStart` | 0 – 0.85 | 0.38 | where along the window the roof begins, so it stops short of the screen |

### 2.4 Side lights — `cabin.canopy`

Meant for a **windscreen** build; with a full canopy the two openings meet.

| field | range | default |
|---|---|---|
| `sides` | bool | false |
| `sideTop` | 0.05 – 0.75 | 0.34 |
| `sideDepth` | 0 – 1 | 0.5 |
| `sideReach` | 0.2 – 1 | 1.0 |
| `sideGap` | 0 – 0.6 | 0.10 — the door post between screen and light |

### 2.5 Coaming & instrument panel — `cabin.panel`

| field | range | default |
|---|---|---|
| `on` | bool | true |
| `depth` | 0.05 – 1.20 | 0.27 — how far aft the coaming shelf runs |
| `inset` | 0 – 0.25 | 0.06 |
| `wrap` | 0 – 1 | 0.50 — how far down the sill arc it wraps; 0.5 is exactly the sill |

### 2.6 Seats — `cabin`

| field | range | default |
|---|---|---|
| `seatX` | −0.45 – 0.45 | 0 — an **offset** about a per-layout base (§5) |
| `seatY` | 0.06 – 0.50 | 0.10 — squab above the cabin floor |
| `seatPitch` | 0.55 – 1.35 | 0.86 — a real distance between tandem seats, not a fraction of the cabin |

### 2.7 Occupant — `cabin.pilot`

A crash-test dummy on the first `cabin.pilots` seats. `stature` is standing
height in metres; everything else is a pose angle in degrees. The rig is
anthropometric (Drillis & Contini fractions), so the one length scales the
figure and every chain hangs off the one before it.

| field | range | default |
|---|---|---|
| `show` | bool | true |
| `stature` | 1.45 – 2.05 | 1.75 |
| `lean` | −5 – 45 | 17 |
| `thigh` | −20 – 40 | −9 |
| `shank` | 10 – 95 | 10 |
| `armDown` | −10 – 90 | 40 |
| `fore` | −45 – 60 | 6 |
| `head` | −25 – 25 | −11 |
| `armIn` | −10 – 40 | 26 |
| `hipOut` | −5 – 35 | 0 |
| `kneeOut` | −5 – 35 | 3 |
| `ankle` | −25 – 40 | 40 |
| `toeOut` | 0 – 30 | 7 |

Defaults 2.5 – 2.7 are the user's own calibration, taken off the harness.

### 2.8 Elsewhere

- `fuselage.tailY` (−0.60 – 0.80, default 0) — tail-end section height. Not a new
  dimension: it moves `tailBot` and `tailTop` together in `clampSpec`, on the
  clone, so `61_gen_frame.js` still reads only those two and the offset cannot
  accumulate the way `gear.track` once did.
- `paint.regX` (0 – 1, default 0.30) — where the registration sits along the body.
  It was pinned at 45–78% of the run, which put it in the taper on a long
  fuselage.

---

## 3. Panel rows for `garage.js`

Add these as new `SECTIONS` blocks after `Cabin & cargo`. `led: []` — none of it
has mass or price of its own; the covering is already billed by
`61_gen_frame.js`.

```js
{ L: 'Glazing', led: [], items: [
  { t: 'sel', L: 'Glazing', p: 'cabin.glazing',
    o: [['none','None'],['windshield','Windscreen only'],['bubble','Canopy']] },
  { t: 'sel', L: 'Wing bay', p: 'cabin.wingBay',
    o: [['solid','Solid'],['skylight','Skylight'],['open','Open (roof)']] },
  { t: 'chk', L: 'Faceted',     p: 'cabin.canopy.facet' },
  { L: 'Rise above deck', p: 'cabin.canopy.height', min: 0,    max: 0.90, st: 0.02, u: ' m' },
  { L: 'Width',           p: 'cabin.canopy.width',  min: 0.85, max: 1.60, st: 0.02, u: '×' },
  { L: 'Fullness',        p: 'cabin.canopy.bubble', min: 0,    max: 1,    st: 0.05, u: '' },
  { L: 'Lid',             p: 'cabin.canopy.lid',    min: 0.25, max: 1,    st: 0.05, u: '' },
  { L: 'Sill depth',      p: 'cabin.canopy.sill',   min: 0.10, max: 0.85, st: 0.02, u: '' },
  { L: 'Reach',           p: 'cabin.canopy.x1',     min: 0.6,  max: 4.0,  st: 0.05, u: ' m' },
  { L: 'Front rake',      p: 'cabin.canopy.skew',   min: 0.20, max: 1.60, st: 0.05, u: '' },
  { t: 'sel', L: 'Corner', p: 'cabin.canopy.joint',
    o: [['square','Square'],['chamfer','Chamfered']] },
  { L: 'Chamfer run',     p: 'cabin.canopy.jointRun', min: 1, max: 8, st: 1, u: '' },
] },
{ L: 'Windscreen & roof', led: [], items: [
  { L: 'Screen angle', p: 'cabin.canopy.wsAngle',  min: 22, max: 80,   st: 1,    u: '°' },
  { L: 'Screen bow',   p: 'cabin.canopy.wsCurve',  min: 0,  max: 1,    st: 0.05, u: '' },
  { L: 'Sunscreen',    p: 'cabin.canopy.sun',      min: 0,  max: 0.92, st: 0.04, u: '' },
  { L: 'Roof from',    p: 'cabin.canopy.sunStart', min: 0,  max: 0.85, st: 0.05, u: '' },
] },
{ L: 'Side windows', led: [], items: [
  { t: 'chk', L: 'Side lights', p: 'cabin.canopy.sides' },
  { L: 'Top',       p: 'cabin.canopy.sideTop',   min: 0.05, max: 0.75, st: 0.02, u: '' },
  { L: 'Depth',     p: 'cabin.canopy.sideDepth', min: 0,    max: 1,    st: 0.05, u: '' },
  { L: 'Reach',     p: 'cabin.canopy.sideReach', min: 0.2,  max: 1,    st: 0.05, u: '' },
  { L: 'Door post', p: 'cabin.canopy.sideGap',   min: 0,    max: 0.6,  st: 0.02, u: '' },
] },
{ L: 'Cockpit interior', led: [], items: [
  { t: 'chk', L: 'Panel',   p: 'cabin.panel.on' },
  { L: 'Panel depth',       p: 'cabin.panel.depth', min: 0.05, max: 1.20, st: 0.01, u: ' m' },
  { L: 'Panel wrap down',   p: 'cabin.panel.wrap',  min: 0,    max: 1,    st: 0.05, u: '' },
  { L: 'Seat station',      p: 'cabin.seatX',       min: -0.45, max: 0.45, st: 0.01, u: ' m', sign: 1 },
  { L: 'Squab height',      p: 'cabin.seatY',       min: 0.06, max: 0.50, st: 0.01, u: ' m' },
  { L: 'Tandem seat pitch', p: 'cabin.seatPitch',   min: 0.55, max: 1.35, st: 0.01, u: ' m' },
] },
{ L: 'Occupant', led: [], items: [
  { t: 'chk', L: 'Show dummy', p: 'cabin.pilot.show' },
  { L: 'Stature',            p: 'cabin.pilot.stature', min: 1.45, max: 2.05, st: 0.01, u: ' m' },
  { L: 'Torso recline',      p: 'cabin.pilot.lean',    min: -5,   max: 45,   st: 1, u: '°' },
  { L: 'Thigh below horiz',  p: 'cabin.pilot.thigh',   min: -20,  max: 40,   st: 1, u: '°' },
  { L: 'Shank below horiz',  p: 'cabin.pilot.shank',   min: 10,   max: 95,   st: 1, u: '°' },
  { L: 'Upper arm down',     p: 'cabin.pilot.armDown', min: -10,  max: 90,   st: 1, u: '°' },
  { L: 'Forearm down',       p: 'cabin.pilot.fore',    min: -45,  max: 60,   st: 1, u: '°' },
  { L: 'Head tilt',          p: 'cabin.pilot.head',    min: -25,  max: 25,   st: 1, u: '°' },
  { L: 'Arms in',            p: 'cabin.pilot.armIn',   min: -10,  max: 40,   st: 1, u: '°' },
  { L: 'Hip splay',          p: 'cabin.pilot.hipOut',  min: -5,   max: 35,   st: 1, u: '°' },
  { L: 'Knee splay',         p: 'cabin.pilot.kneeOut', min: -5,   max: 35,   st: 1, u: '°' },
  { L: 'Foot pitch',         p: 'cabin.pilot.ankle',   min: -25,  max: 40,   st: 1, u: '°' },
  { L: 'Toe out',            p: 'cabin.pilot.toeOut',  min: 0,    max: 30,   st: 1, u: '°' },
] },
```

Plus one row on the existing **Fuselage** block and one on **Paint & finish**:

```js
{ L: 'Tail height',  p: 'fuselage.tailY', min: -0.60, max: 0.80, st: 0.02, u: ' m', sign: 1 },
{ L: 'Registration', p: 'paint.regX',     min: 0,     max: 1,    st: 0.02, u: '' },
```

Two things the panel does not have yet:

1. **`t: 'chk'`** — a checkbox row, for the five booleans. A two-option `sel`
   (`[['0','No'],['1','Yes']]`) works today with no new control type and is the
   smaller change; a real checkbox is nicer.
2. **Nullable slider semantics.** `x1` and `wsAngle` are nullable-derived, so they
   belong to the AUTO path `refresh()` already implements — `isAuto` reads
   `get(spec, p) == null`, the slider shows `api.resolved()`'s value in italic
   until dragged. That path needs no change; just do not seed them with a number.

`ITEMS` / `DERIVED` need nothing new — no derived controls here.

---

## 4. `app.js`

Two lines.

```js
// texture loop: the bump and metal/rough sheets must decode LINEAR
if (data.generated && !(data.linTex || []).includes(t))
  texs[t].encoding = THREE.sRGBEncoding;

// applySkinVis: the new covering groups hide with the covering
const COVER = new Set(['skin','cowl','decal','canopy','gcabin','cframe','sunscr',
                       'dash','seat','seatpipe','seatframe','pilot','pilotjoint']);
model.meshes[n].visible = (n === 'frame' || n === 'engine') ? skinMode === 2
                        : COVER.has(n) ? skinMode < 2 : true;
```

`garage.js` hands the two data sheets over beside `paint` / `reg` / `tyre`:

```js
data.texs = { paint: genPaintDataURI(spec), reg: genRegDataURI(spec),
              tyre: TYRE_TEX, bump: genBumpDataURI(spec), mr: genMrDataURI(spec) };
```

`m.nrm` / `m.mr` are already plumbed through `matFor` by the C172's glTF path.

---

## 5. The rules a maintainer has to know

Each of these was a bug first. They are invariants now, and a change that breaks
one will look like the original symptom.

**Every glazing vertex is a ring vertex, or an interpolation between two of
them,** carrying the same eight node weights the covering carries, summing to 1.
That is what keeps GATE GEN's skin/structure coherence check green *and* what
makes the seams exact rather than nearly exact. Anything that samples the shell
independently of the body's rings reintroduces the gaps this pass removed.

**The sill is a height plane, not a ring index.** A constant ring index is a
constant *angle*, and on a crowned tapering body that angle wanders in y — the
opening's lower edge waved and no canopy could read as flat. Each row cuts at
whichever ring vertex first falls below `y = ySill`: stepped to the topology, but
stepped along a straight line, and following the deck down once the body tapers
under it.

**The crown line is relative to the body.** It used to be absolute — a ramp from
the front seam's height to a fixed peak over `rake` of the *window*, while the
fuselage's deck rises over the *windscreen run*. Two different lengths, so
wherever the ramp got there first the shell stood off the body as a slab. It is
the body's own deck plus a bump that is zero at both seams, which is what makes
`height = 0` mean "the face turns to glass" and makes the windscreen angle the
fuselage's angle by construction rather than by agreement.

**The console reads the same `hsOf()` the cut does.** It was bounded by where the
section falls away from the cowl deck — a different line — so lowering the sill
opened a gap between coaming and opening. Two functions describing one line will
drift; one function cannot.

**The canopy's resolution is its own.** 7 rows per station, 7 samples per ring
step, with `basePt` blending between the body's own chord and a Catmull-Rom
through the surrounding ring points — weighted 0 on the two seam rows and 1
inside. The seam still lands on the covering's polyline exactly, while the dome
reads round at a resolution the fuselage does not pay for.

**Seat station is a per-layout base plus an offset.** `SEAT_BASE` in
`63_gen_skin.js`: `side2 −0.03`, tandem/single `+0.41`, measured on the builds the
user calibrated. Zero means "right" in either layout; a single common base means
one of them always carries a constant the other has to undo.

---

## 6. Gates

- **GATE GEN** skin/structure coherence: holds by construction (§5, first rule).
- **GATE UISMOKE**: the bakes are canvas work in the viewer block it stubs.
- Determinism: no randomness anywhere in the new code.
- Structure, mass, CG, strips, ledger, substeps: unchanged.
- Cost, stock spec, covered: ~9.4k → ~28k triangles. Most of that is the
  resolution rise (40 radial / 4 slices per bay) and the occupant, not the
  glazing. Against a 186k-tri C172 and a ~1M-tri forest this is still nothing,
  but it is the one number worth re-measuring on the target machine — and the
  dummy is the obvious thing to LOD out at distance if it ever matters.

---

## 7. Open, not done

- **Strut and tube attachment fittings** — the one item from this session's list
  that was never started.
- **Instruments.** The panel face is a flat fan with a proper outline; dials,
  bezels and a stick are the next visible step, and they are real geometry.
- **Interior trim.** The sheet behind the glass is a flat dark colour: no floor
  texture, no side pockets, no upholstery on the cabin walls.
- **Rib tape count** is a constant (13 per semispan); it should be the rib count
  `61_gen_frame.js` already derives from 0.4 m spacing. One line, left alone
  because it moves the UV pitch of every existing build.
- **`sides` + a full canopy** is not guarded — the two openings meet. Either gate
  it in `clampSpec` or leave it as a mistake the player is allowed to make, which
  is the house style.
- **The dummy has no hands or face**, deliberately: it is a crash-test dummy, and
  fingers at this scale cost more than they read.
