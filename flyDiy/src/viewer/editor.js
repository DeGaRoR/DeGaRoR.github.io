// ============================================================
// THE EDITOR PANEL (G77) — the part tree and the inspector.
//
// ROADMAP P8 §4/§5/§6, and the UI half of the 9b rebaseline. The editor used
// to be one 400 px column holding four unrelated things and a flat accordion
// of 537 rows in eighteen groups whose names (`1 · global`, `4b · aft cabin`,
// `don't touch`) were a numbering that grew with the benches. Nothing on that
// screen said which slider belonged to which part of the aeroplane.
//
// Now there are two columns and each has one job:
//   THE PARTS COLUMN selects. It never edits.
//   THE PROPERTIES COLUMN edits the selection. Only the selection.
//
// ---------------------------------------------------------------------------
// IT DOES NOT BUILD A SINGLE WIDGET, AND THAT IS THE WHOLE DESIGN.
//
// Every row on screen is _cage_ui.js's own DOM node, MOVED here. The typed
// value and its clamp, the double-click-label reset, the `link` checkbox that
// makes a sentinel visible, the `= front` one-shot copy, the `≈ m` readout
// that follows planeScale, the `when` clauses that hide a row live — all of it
// is the same code running on the bench pages, because it is literally the
// same elements. A second implementation of the row grammar would drift from
// the first inside a week, and the drift would be invisible: both would look
// like sliders.
//
// So this file only ever does four things: it moves rows, it decides which
// rows and which headings are visible, it counts what has changed, and it
// draws a tree. `_cage_ui.js` gained exactly three hooks for it —
// CAGE_ON_ROWS (the rows exist), CAGE_ON_VIS (visibility has been recomputed)
// and a handful of published handles — and nothing else in that file moved.
//
// WHAT IT READS: tools/_cage_parts.js, the declared assembly (G76). Which part
// owns which parameter, which sections a part is made of, what the tree's
// nesting is, and which rows are the placement strip. GATE PARTS keeps that
// table honest against the editor's real row list, so a slider cannot go
// missing here without a red battery.
// ============================================================

function editorInit(api) {
  const $ = id => document.getElementById(id);
  const wrap = $('edWrap');
  if (!wrap) return;                       // core-only build

  const PT = window.CAGE_PARTS;            // the declared assembly (G76)
  if (!PT) return;

  const treeEl = $('edTree'), rowsEl = $('edRows');
  // WHERE A ROW LIVES WHEN IT IS NOT ON SCREEN. The inspector shows one part
  // at a time and there are 537 rows; the rest are parked here, in the
  // document but not visible, because _cage_ui goes on addressing every one of
  // them (syncSliders writes their values, applyRowVis writes their display)
  // whether or not the part they belong to is selected. Detaching them would
  // work too and read as a leak.
  const nursery = document.createElement('div');
  nursery.id = 'edNursery';
  nursery.hidden = true;
  wrap.appendChild(nursery);
  const LS_SEL = 'flydiy.edPart', LS_COL = 'flydiy.edParts',
        LS_OPTS = 'flydiy.edOpts', LS_INFO = 'flydiy.edInfo',
        LS_PROP = 'flydiy.edProps', LS_VIEW = 'flydiy.edView';
  const pref = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  };

  let treeSig = '';                        // only redraw when the tree changes
  // WHICH ASSEMBLIES ARE FOLDED. Persisted as one comma-joined string: the
  // tree has forty rows over three levels and no way to put a branch away.
  const LS_FOLD = 'flydiy.edFold';
  const folded = new Set(String(pref(LS_FOLD) || '').split(',').filter(Boolean));
  const saveFolded = () => pref(LS_FOLD, [...folded].join(','));

  // =========================================================================
  // THE SECTIONS ROLL UP (2026-09-03, the user: "the sections should be
  // collapsible themselves. That will be particularly useful for large
  // panels. We could keep the small ones open by default, but beyond 5
  // parameters, minimize by default, so we keep an overview. Options for
  // collapsing and extending all. Setup remembered.")
  // =========================================================================
  // THE DEFAULT IS A RULE, NOT A STORED STATE, and that distinction is the
  // whole design. Only what the USER has decided is written down; everything
  // else answers the rule afresh — so a group that grows past the threshold
  // (a leg kind switched, an expert row revealed) rolls itself up, and a
  // group the user opened stays open whatever it grows into. Storing a
  // boolean for all ~200 sections instead would freeze today's row counts
  // into a preference file and quietly stop tracking the panel.
  //
  //   the rule    open at SEC_OPEN rows or fewer, rolled up above it
  //   the trunk   ALWAYS open by default — 'fitted', 'type', 'position'
  //               and 'size' ARE the overview the user asked to keep, and
  //               the engine's 'type' (6 rows) is exactly the group you
  //               must not have to unroll to find the preset
  //   a part      a part heading (an assembly or the root is showing several)
  //               rolls its whole part away, groups and all
  //
  // Counted on VISIBLE rows, not declared ones: a group of nine whose 'when'
  // leaves two on screen is a group of two to the person reading it.
  const LS_SEC = 'flydiy.edSec';
  const SEC_OPEN = 5;
  const TRUNK = new Set(['fitted', 'type', 'position', 'size']);
  const secPref = new Map();
  for (const t of String(pref(LS_SEC) || '').split(',')) {
    const i = t.lastIndexOf('=');
    if (i > 0) secPref.set(t.slice(0, i), t.slice(i + 1) === '1');
  }
  const saveSec = () => pref(LS_SEC,
    [...secPref].map(([k, v]) => k + '=' + (v ? 1 : 0)).join(','));
  // a part heading's own key is the part with no group: it is the section
  // ABOVE the groups, and it folds them with it
  const secKey = (pk, g) => pk + '/' + (g === null || g === undefined ? '*' : g);
  const secShut = (pk, g, n) => {
    const k = secKey(pk, g);
    if (secPref.has(k)) return secPref.get(k);
    return g != null && n > SEC_OPEN && !TRUNK.has(g);
  };
  // A FINISH SECTION DEFAULTS OPEN, whatever it holds, and it is keyed on
  // something that does not move. Two reasons, both found by running it:
  //
  //   the count rule is wrong here. The finish view draws ONE block per part
  //   (its finish, tint, tile, roughness and normal dials), so a block over
  //   five elements is not a long tail of detail — it is the whole view, and
  //   folding it by default left a column of headings with nothing under any
  //   of them.
  //
  //   and the NAME is not stable. A finish block is headed by the part's own
  //   name, which carries its count ("Passenger bay x2"), so keying the fold
  //   on the heading text would file the same section under a new key every
  //   time a bay was added. `secG` on the group is the stable one.
  const secShutFinish = (pk, g) => {
    const k = secKey(pk, g);
    return secPref.has(k) ? secPref.get(k) : false;
  };
  // the heading IS the control: the chevron says which way it goes and the
  // count says what is behind it, so a rolled-up section still tells you how
  // much it is holding
  const secPaint = (head, shut, n) => {
    const i = head.children[1];
    if (!i) return;
    const t = shut ? '\u25b8' + (n ? '\u2009' + n : '') : '\u25be';
    if (i.textContent !== t) i.textContent = t;
    if (head.classList.contains('shut') !== shut)
      head.classList.toggle('shut', shut);
  };
  // WIRED ON THE HEADING THE PANEL ALREADY BUILDS, and it reads the class the
  // last paint left rather than recomputing the rule — what the user is
  // toggling is what they can see.
  // the pill's own two jobs, asked of what is ON SCREEN: while one group is
  // open there is something to fold, and once none is, the only useful press
  // is the one that opens them again.
  const secAllWants = () => {
    for (const g of groupsOf)
      if (g.head && !g.head.classList.contains('hide') &&
          !g.head.classList.contains('shut')) return 'fold';
    return 'open';
  };
  const secAllLabel = () => {
    const b = $('edSecAll');
    if (b) b.textContent = secAllWants() === 'fold' ? 'fold sections'
                                                    : 'open sections';
  };
  const secWire = (head, pk, g) => {
    head.classList.add('edHC');
    head.onclick = () => {
      secPref.set(secKey(pk, g), !head.classList.contains('shut'));
      saveSec();
      applyVis();
    };
  };

  // =========================================================================
  // THE TOP OF THE TREE IS A SCENE, NOT AN AEROPLANE
  // =========================================================================
  // The tree's top level is the list of things in the room you can select and
  // tune: the aeroplane you are building, the reference standing beside it,
  // the shed, and the world outside the door. They are PEERS and they read as
  // peers — one name style, one font, one row.
  //
  // WHY A REGISTRY AND NOT A LIST. The reference plane arrived (G90) as five
  // `if (key === REF_KEY)` branches through this file, which worked and was
  // the honest first move — but the shed is next and the world after it, and
  // three more objects is fifteen more branches. A root DECLARES itself
  // instead:
  //
  //   window.CAGE_TREE_ROOTS.add({
  //     key, name, order,
  //     parts:   true            — its branch comes from tools/_cage_parts.js
  //     panel:   () => Element   — ...or it builds its own properties pane
  //     badge:   () => string    — optional, right-hand mark on the row
  //     meta:    string          — optional, the properties column's foot line
  //     shown:   on => {}        — optional, told when it is/stops being shown
  //     refresh: () => {}        — optional, called at the end of every build
  //   })
  //
  // so the shed's session adds a root without editing this file, which is the
  // scalable answer the user asked for — and the thing three sessions editing
  // one file most needed.
  const ROOTS = [];
  const rootFor = k => { for (const r of ROOTS) if (r.key === k) return r; return null; };
  function registerRoot(r) {
    if (!r || !r.key || rootFor(r.key)) return;
    ROOTS.push(r);
    ROOTS.sort((a, b) => (a.order | 0) - (b.order | 0));
    treeSig = '';                            // the tree's shape just changed
  }
  window.CAGE_TREE_ROOTS = { add: registerRoot, list: () => ROOTS.slice() };
  // THE BUILD. Its branch is the declared assembly, so it needs no panel of
  // its own — selecting it shows every row, which is the user's "top layer
  // where everything is visible".
  // THE NAME COMES FROM THE PART TABLE, not from here. The tree row and the
  // title bar read two different declarations of it, so renaming the root
  // renamed it in one of the two places and left "Build plane" in the other.
  registerRoot({ key: 'craft', order: 0, parts: true,
                 name: (PT.partByKey.craft && PT.partByKey.craft.name) || 'My Plane' });
  // THE REFERENCE (G90, ROADMAP F1), registered here rather than by
  // refplane.js only because that file belongs to another session in flight;
  // the four lines below are its to take back whenever it likes.
  const REF_KEY = 'ref';
  registerRoot({
    key: REF_KEY, name: 'Reference plane', order: 10,
    meta: 'display only · not part of your build',
    panel: () => {
      if (window.REFPLANE) { window.REFPLANE.shown(true); return window.REFPLANE.panel(); }
      const w = document.createElement('div');
      w.className = 'refNote';
      w.textContent = 'The reference plane is not in this build.';
      return w;
    },
    badge: () => (window.REFPLANE && window.REFPLANE.badge()) || '',
    refresh: () => { if (window.REFPLANE && window.REFPLANE.refresh) window.REFPLANE.refresh(); },
  });
  // THE SHED (G108; THE WORLD ROOT RETIRED at G136, the user: "I think we can
  // get rid of the world entry, we have it in the main UI"). The world's whole
  // panel was three rows the `night` flyout already shows — a second door to
  // the same three controls, and the styling of a panel nobody had dressed.
  // The root is gone; the rows stay reachable where the LOOKING question is
  // asked, in the rail's flyout.
  //
  // NOTHING IS MOVED OUT OF THE HANGAR GROUP ANY MORE. G108 pulled `lights`
  // out to the shed host and three rows to the world's, and finding them BY
  // LABEL is how the aeroplane's own lights master got STOLEN into the shed
  // panel: `lightOn`'s row wears the same `lights` label, and with the shed
  // selected the shed's own rows are in the column while the aeroplane's sit
  // first in the nursery — so the index handed fillRoots the wrong object's
  // row, and the shed's panel grew a second `lights` bar at its foot. The
  // rows keep their birth order inside the group instead; labelIndex still
  // finds them there for the `night` flyout, which borrows and returns.
  const shedHost = document.createElement('div');
  shedHost.className = 'edRoot';
  nursery.appendChild(shedHost);

  function fillRoots() {
    // A ROOT'S HOST NEEDS A HOME. The parking loop keeps `.r` rows and
    // anything with a `homeOf` entry and REMOVES the rest — which is right
    // for the reference panel (refplane.js owns it whole) and wrong for this
    // host: detached, it is no longer under the nursery, so `labelIndex`
    // cannot find the rows inside it and the `night` flyout comes up empty.
    // Set HERE and not at construction, because `homeOf` is declared further
    // down the file and a root is registered before it exists.
    homeOf.set(shedHost, nursery);
    const hd = document.querySelector('#edWrap details[data-g="hangar"]') ||
               nursery.querySelector('details[data-g="hangar"]');
    if (hd && hd.parentElement !== shedHost) { hd.open = true; shedHost.appendChild(hd); }
    hookMoodSelect();
    syncNightLabel();
    // the quick bar wears the mood too, and a mood can arrive without the
    // select's change event — a hangar swap, a payload's own default
    syncQuick();
  }
  const rootNote = (host, txt) => {
    if (host.querySelector('.r, details')) return host;
    const n = document.createElement('div');
    n.className = 'refNote';
    n.textContent = txt;
    host.appendChild(n);
    return host;
  };
  registerRoot({ key: 'shed', name: 'The shed', order: 20,
    meta: 'the room you build in, and the sky outside its door',
    panel: () => { fillRoots();
      return rootNote(shedHost, 'The shed is not in this build.'); } });

  let sel = pref(LS_SEL) || 'craft';
  if (!PT.partByKey[sel] && !rootFor(sel)) sel = 'craft';
  // =========================================================================
  // TWO VIEWS OF ONE TREE (G103) — UI-MODEL §2.3
  // =========================================================================
  // The user: "we'll split structure and livery". The split is real and it is
  // NOT a second panel: the tree stays the only selector — the noun — and the
  // tab is the ADJECTIVE. Select the cowl and ask what shape it is; select the
  // cowl and ask what it is made of. Two panels would need two trees, two
  // selections and two answers to "which part am I looking at", which is the
  // confusion this whole arc exists to end.
  //
  // SHAPE  is the parameter rows, by part — everything above.
  // FINISH is the AEROSKIN rows, by SECTION, moved under the part whose
  //        `sections` claim them; and on the root, the whole-aeroplane livery
  //        (construction, condition, decals) that belongs to no part at all.
  // ...and DESIGN (2026-08-31, the user: "we'll now have 3 of them"): the
  // whole aeroplane's macro rows — the tiles — as a third view. Selection-
  // independent by nature: whatever part is selected, the DESIGN question is
  // about the machine whole, which is what lets the tab replace the old
  // "tiles when the design part is selected" dispatch without costing the
  // design part its raw rows (they are SHAPE's again, convertible/open back
  // on their slider).
  // 2026-09-04: DESIGN is no longer a tab — it is the Custom-build window
  // NEW opens (EDITOR_SET_VIEW), so a boot restores STRUCTURE or FINISH only;
  // the tiles themselves are sprinkled into STRUCTURE by part (render()).
  let view = pref(LS_VIEW) === 'finish' ? 'finish' : 'shape';
  // WHERE A BORROWED ELEMENT GOES BACK TO. The parameter rows have one home
  // (the nursery) and need no map; the finish rows have two — the materials
  // panel's body and the decals panel's — and `buildMatPanel` clears its body
  // by `textContent = ''`, which only reaches the rows that are still IN it. A
  // row left in the inspector across a rebuild is a row that outlives the
  // aeroplane it describes.
  const homeOf = new WeakMap();
  let collapsed = pref(LS_COL) === '1';
  // DESIGN NEEDS NO SELECTION (G136, the user: "auto hide the part selection
  // bar when in design mode"). The tiles are the whole aeroplane's, so the
  // tree has nothing to choose while that tab is up — the column folds to its
  // spine on entry, TRANSIENTLY: the user's own fold preference is neither
  // read nor written, and the spine click still opens the column mid-design.
  let partsAuto = view === 'design';
  const partsAway = () => collapsed || partsAuto;
  let infoOff = false, propsOff = pref('flydiy.edProps') === '1';
  let CU = null;                           // window.CAGE_UI, once it exists
  // key -> the row elements that carry it. A key can have TWO rows: the engine
  // page renders `eng_rpm` under both `electric` and `engine geometry`,
  // deliberately, and both follow the one part that claims it.
  const rowsFor = new Map();
  // row element -> the group-level `when`s it inherited from the accordion it
  // was built in. Captured BEFORE anything moves: once a row is out of its
  // <details>, the group rule that used to hide it cannot reach it, and
  // `seat 2` (crew on, and more than one seat) is the one that matters.
  const inherited = new Map();

  // ---- WHAT "CHANGED" MEANS ---------------------------------------------
  // Changed from THE DESIGN YOU LOADED — _cage_ui's BASELINE, the same target
  // the per-row double-click has reset to since G27 — and not from the
  // generator's defaults. Two things stand between that sentence and a dot
  // that means it:
  //
  // 1. LAYERS RESOLVE PARAMETERS INTO P DURING THE BUILD. The cowl's
  //    fit-to-nose writes cw_aftW/cw_aftH/cw_waist and the two aft squareness
  //    numbers every time it fits, so the first build after a load already
  //    disagrees with the baseline anchored just before it. Those are part of
  //    the design you loaded, not changes you made, so the baseline is taken
  //    again after that build has run.
  // 2. FLOAT NOISE. Half of the disagreement above is in the fifteenth decimal
  //    — a value that went out through cageToSpec and came back. A dot for
  //    that is a dot that never goes away, so a move smaller than half the
  //    row's own step is not a move.
  let lastBase = null, myBase = null, settling = false, touched = false;
  const dirty = new Set();                 // keys that have really moved
  const dirtyOf = (m, P) => {
    if (!myBase || myBase[m.k] === undefined) return false;
    const a = P[m.k], b = myBase[m.k];
    if (typeof a !== 'number' || typeof b !== 'number') return a !== b;
    return Math.abs(a - b) > Math.max(1e-9, (+m.st || 0) / 2);
  };
  // THE BASELINE IS WHAT THE AEROPLANE SETTLES TO, before you touch anything.
  //
  // It cannot simply be _cage_ui's BASELINE, which is a copy of P taken at the
  // instant of the load: a spec that does not mention the cowl's aft section
  // arrives holding the TEMPLATE's numbers, and the fit-to-nose then derives
  // the real ones during the first build. On the sailplane that is 0.535 ->
  // 0.050 — five rows permanently flagged as changed on a design nobody has
  // touched.
  //
  // Nor can it be "the second pass": the number of applyRowVis passes a load
  // costs is not fixed (a mirrored pod adds one, because the FOREVER-SPLIT
  // copy re-syncs the sliders mid-build). So the rule is the honest one —
  // keep taking it until the first thing the builder actually does. `touched`
  // is set by a capture listener on the panel, so it covers every widget
  // without _cage_ui having to report anything.
  function rebaseCheck() {
    if (!CU) return;
    if (CU.BASELINE !== lastBase) {
      lastBase = CU.BASELINE;
      settling = true; touched = false;
    }
    if (settling && !touched) myBase = Object.assign({}, CU.P);
  }

  // =========================================================================
  // TAKING THE ROWS
  // =========================================================================
  function adopt() {
    CU = window.CAGE_UI;
    if (!CU || !CU.ROWMETA) return;
    // 1. inherited group rules, by DOM containment, while the rows are still
    //    where they were built
    for (const meta of CU.ROWMETA) {
      const whens = [];
      for (const g of (CU.GROUPMETA || []))
        if (g.el && g.opts && g.opts.when && g.el.contains(meta.row))
          whens.push(g.opts.when);
      if (whens.length) inherited.set(meta.row, whens);
      if (!rowsFor.has(meta.k)) rowsFor.set(meta.k, []);
      rowsFor.get(meta.k).push(meta);
    }
    // 2. the measurement pane is a fact about the build, not a parameter, and
    //    since G78 it has a home that says so: the view's `measure` flyout
    //    borrows it. Parked until then.
    const dims = $('dims');
    if (dims) nursery.appendChild(dims);
    // ...and so is the mesh-count line (G86): a diagnostic, parked until the
    // display flyout asks for it.
    const st = $('edStat');
    if (st) nursery.appendChild(st);
    // ...and so is the AEROSKIN mode select. There were TWO controls for one
    // idea: `#mat` chose AEROSKIN vs the diagnostic palette (labelled
    // `materials`, left in the overflow), and `#color` chose whether that
    // palette was coloured (labelled `section colours`, in the display
    // flyout) — so the flyout's checkbox did nothing at all unless a select
    // in another panel was already set. The user's ruling: one option, called
    // `section colours`. The checkbox IS the switch now (see the wiring); the
    // select is parked because window.CAGE_AERO_ON reads it and four layers
    // read that, so it stays the mechanism while ceasing to be an interface.
    const matEl = $('mat');
    const matRow = matEl && matEl.closest ? matEl.closest('.r') : null;
    if (matRow) nursery.appendChild(matRow);
    // SECTION COLOURS IS THE WHOLE SWITCH. `#color` used to mean "colour the
    // palette" INSIDE the palette mode, which is why ticking it under
    // `display` could do nothing at all; it means "show the palette" now, and
    // drives `#mat`.
    //
    // It is seeded FROM the persisted mode rather than from its own HTML
    // `checked`, because the two disagree at boot: the markup ships it ticked
    // and AEROSKIN has been the default view since G67.1.
    //
    // The previous handler is CALLED, not replaced: _cage_ui.js assigns
    // `onchange = build` at module load, and the mode has to be written
    // before that rebuild reads it. Wrapping is the only ordering that is not
    // a guess about listener order.
    const colEl = $('color');
    if (colEl && matEl && !colEl.dataset.edMode) {
      colEl.dataset.edMode = '1';
      colEl.checked = matEl.value === 'sections';
      const prev = colEl.onchange;
      colEl.onchange = function (e) {
        matEl.value = colEl.checked ? 'sections' : 'material';
        try { localStorage.setItem('flydiy.cageMatView', matEl.value); }
        catch (err) {}
        if (prev) prev.call(colEl, e);
      };
    }
    // 3. EVERY CLAIMED ROW LEAVES THE ACCORDION NOW, not when it happens to be
    //    selected. The inspector shows one part at a time; the rest have to be
    //    somewhere, and that somewhere cannot be the accordion, because the
    //    accordion is the EDITOR OPTIONS section — opening the editor on the
    //    cabin would otherwise leave the other five hundred rows sitting under
    //    `editor & shed` in their old groups, which is the screen this
    //    chantier exists to replace.
    for (const [k, ms] of rowsFor)
      if (PT.paramOwner[k]) for (const m of ms) nursery.appendChild(m.row);
    // 4. THE VIEW'S ROWS GO TO THE VIEW (G78). Everything the icon rail's
    //    flyouts claim is parked now, not borrowed on demand: left in the
    //    accordion they would sit under `materials & extras` as a second copy
    //    of controls that already have a home, which is exactly the
    //    duplication this screen is being rebuilt to end. What is NOT claimed
    //    stays behind on purpose — `materials` (the AEROSKIN mode) is the
    //    aeroplane's finish, not a way of looking at it.
    {
      const idx = labelIndex();
      for (const t of RAIL)
        for (const label of (t.rows || [])) {
          const r = idx.get(label);
          if (r) nursery.appendChild(r);
        }
    }
    // 5. THE ROOM GOES TO ITS OWN ROOT, whole (G108). It went to a SHEET at
    //    G78 on the ruling that tuning the room is a different interface from
    //    designing an aeroplane — which was true and is now the wrong answer
    //    to it, because the world arrived and a second bespoke pane per scene
    //    object does not scale. It is a tree root; the `night` flyout still
    //    borrows the light rows back and returns them.
    fillRoots();
    // 6. ...and the emptied accordion groups go with the rows. They are MOVED,
    //    not removed: _cage_page5.js's derived selectors are injected by
    //    `CAGE_PAGE_SETUP` after this runs and find their host by
    //    `details[data-g=...]`, so the host has to still be in the document.
    //    See collectDerived.
    const ui = $('cgUi');
    if (ui) for (const det of Array.from(ui.children)) {
      if (det.tagName !== 'DETAILS') continue;
      if (!det.querySelector('.r')) nursery.appendChild(det);
    }
    // an overflow section with nothing in it is a heading about nothing
    if (ui) wrap.classList.toggle('opts-empty', !ui.querySelector('.r'));
    // what stays in #cgUi is what the part table does NOT claim — how you look
    // at the build, the shed, and the aeroplane's materials: exactly the split
    // the user asked for, "the options belonging to the editor and not the
    // settings of the plane".
    render();
  }

  // ---- the derived selectors ---------------------------------------------
  // `_cage_page5.js` injects two rows that are not parameters: an intent that
  // writes several raw params at once (the nose CONFIGURATION, the seating
  // STARTER). They are the ride-along philosophy — a high-level choice, derived
  // details, every slider still editable afterwards — and they belong in the
  // inspector beside the rows they write. They have no key, so the part table
  // cannot place them; this does, by the accordion path they were injected at.
  // BOTH OF THEM ARE DISCRIMINATORS, so both go to `Design & construction`
  // (G108). A row that writes several raw params at once from one high-level
  // choice is the definition of the thing that part exists to hold, and they
  // were the two loudest examples of a decision about the WHOLE aeroplane
  // filed under one part of it.
  const DERIVED = {
    '2 · engine': ['design', 'configuration'],
    '4 · cabin/dimensions': ['design', 'configuration'],
  };
  const extraRows = new Map();             // 'partKey/group' -> [row, …]
  function collectDerived() {
    for (const path in DERIVED) {
      const det = nursery.querySelector('details[data-g="' + path + '"]') ||
                  document.querySelector('#edWrap details[data-g="' + path + '"]');
      if (!det) continue;
      for (const r of det.querySelectorAll(':scope > .r')) {
        if (r.dataset.k) continue;         // a real parameter row, already ours
        const at = DERIVED[path].join('/');
        if (!extraRows.has(at)) extraRows.set(at, []);
        if (extraRows.get(at).indexOf(r) < 0) extraRows.get(at).push(r);
      }
    }
    render();
  }

  // =========================================================================
  // WHAT A SELECTION SHOWS
  // =========================================================================
  // A part shows its own groups. An ASSEMBLY shows every part under it, each
  // under its own name. The ROOT shows the lot — the user's own requirement,
  // and the reason the tree narrows the panel rather than being the only way
  // to reach a row: "we should still have a top layer where everything is
  // visible".
  // memoised: the answer is the table's SHAPE, which never changes at runtime
  // (what changes is which of those parts exists, and that is `exists`). Every
  // tree line asks for it on every build, and a build happens on every pixel of
  // a slider drag.
  const shownCache = new Map();
  const partsShown = key => {
    if (shownCache.has(key)) return shownCache.get(key);
    const p = PT.partByKey[key];
    let out = [];
    if (p) {
      if (p.root) out = PT.cagePartsUnder('craft');
      else out = PT.CAGE_PARTS.some(c => c.parent === key)
        ? PT.cagePartsUnder(key) : [p];
    }
    shownCache.set(key, out);
    return out;
  };

  const crumbFor = key => {
    const out = [];
    let p = PT.partByKey[key];
    while (p && p.parent) { p = PT.partByKey[p.parent]; if (p) out.unshift(p.name); }
    return out.length ? out.join(' / ') + ' /' : '';
  };

  const nameOf = p => {
    if (!p.count || !CU) return p.name;
    const n = p.count(CU.P);
    return n > 1 ? p.name + ' ×' + n : p.name;
  };

  const exists = p => {
    if (!p.when || !CU) return true;
    try { return !!p.when(CU.P); } catch (e) { return true; }
  };

  // =========================================================================
  // A PART THAT IS SWITCHED OFF COLLAPSES TO ITS SWITCH (2026-09-03)
  // =========================================================================
  // The user, having turned the fin off: "all references to it disappear, and
  // there's no way to get it back... the objects should never be fully hidden,
  // they can simply collapse to the checkbox, but they should remain
  // available."
  //
  // It was a one-way door, and a durable one — `finOn: 0` rode out through
  // cageToSpec into the saved build and into the WIP autosave, so a reload
  // brought the fin-less aeroplane back with no fin row anywhere on the panel.
  // Eight parts carried it: the taper, the fittings, the fin, the stabiliser,
  // the engine, the cowl, the propeller and the lights — every part gated on a
  // switch IT ITSELF OWNS (`gate` in the part table; GATE PARTS derives which
  // those are, so a ninth cannot be added without one).
  //
  // The rule is one line: a gated-off part keeps its tree row and its own
  // switch, and shows nothing else. `exists` is left alone — the highlight,
  // the finish view and the changed dots all still mean "on the aeroplane" —
  // and this answers the different question of what you can still REACH.
  //
  // WHETHER THE SWITCH IS ITSELF REACHABLE is asked, not assumed: `propOn`'s
  // row is hidden while the engine is off (a propeller without an engine is
  // not a thing to draw), and a tree row leading to an empty column would be
  // the same complaint one level along. So a part whose switch is out of sight
  // stays out of the tree, and comes back the moment the row above it does.
  const gateRow = p => {
    if (!p || !p.gate || !CU) return null;
    const ex = CU.EXPERT && CU.EXPERT.on;
    // an EXPERT group is hidden wholesale by applyVis, so a switch filed in
    // one is no way back while expert rows are off — ask the same question
    // here rather than leaving a tree row over an empty column
    if (!ex)
      for (const g of (p.groups || []))
        if (g[2] === PT.EXPERT && g[1].indexOf(p.gate) >= 0) return null;
    for (const m of (rowsFor.get(p.gate) || [])) {
      const o = m.opts || {};
      if (o.level === 'expert' && !ex) continue;
      let vis = true;
      if (o.when) { try { vis = !!o.when(CU.P); } catch (e) {} }
      if (vis) for (const w of (inherited.get(m.row) || [])) {
        try { if (!w(CU.P)) { vis = false; break; } } catch (e) {}
      }
      if (vis) return m;
    }
    return null;
  };
  // switched off, but still holding the row that switches it back on
  const switchedOff = p => !exists(p) && !!gateRow(p);
  // in the tree: on the aeroplane, or reachable enough to be put back on it
  const inTree = p => exists(p) || switchedOff(p);

  // =========================================================================
  // THE INSPECTOR
  // =========================================================================
  // Rebuilt on selection, not on every parameter change: moving DOM nodes
  // under the user's cursor while they drag a slider is how a panel loses a
  // drag. Visibility and the changed dots are updated in place instead.
  const groupsOf = [];                     // [{head, part, group, rows}]
  const headParts = new Set();             // parts whose OWN heading is drawn

  function render() {
    if (!CU) return;
    // ANYTHING THE FLYOUT IS HOLDING COMES HOME FIRST. A borrowed row is not
    // a child of this column, so the parking loop below cannot see it — and
    // returning it later would drop it into a column that has moved on.
    returnRows();
    groupsOf.length = 0;
    headParts.clear();
    // rows are PARKED, never destroyed: they are _cage_ui's elements and its
    // syncSliders/applyRowVis keep addressing them whether or not the part
    // they belong to is the one on screen.
    for (const el of Array.from(rowsEl.children)) {
      const home = homeOf.get(el);           // a borrowed finish row goes back
      if (home) home.appendChild(el);
      else if (el.classList.contains('r')) nursery.appendChild(el);
      else el.remove();
    }
    // THE REFERENCE PANEL (G90). It is not built here and it is not a row of
    // _cage_ui's: refplane.js owns it whole, hands back ONE element, and that
    // element is re-appended rather than rebuilt, so a slider survives a
    // selection round-trip. The parking loop above already took it out — it
    // is not `.r`, so it went down the `else el.remove()` branch — which is
    // why that loop needed no case of its own.
    {
      const r = rootFor(sel);
      if (r && r.panel) {
        rowsEl.appendChild(r.panel());
        applyVis();
        reopenFly();
        return;
      }
    }
    // THE DESIGN TILES (design_flow.js): the macro rows as the THIRD VIEW,
    // shaped exactly like the FINISH dispatch below — one branch, no
    // navigation axis. Whole-aeroplane by nature, so the selection rides
    // along untouched and the design part's raw rows stay SHAPE's.
    if (view === 'design' && window.DESIGN_FLOW &&
        window.DESIGN_FLOW.renderTiles(rowsEl)) {
      applyVis(); reopenFly(); return;
    }
    if (view === 'finish') { renderFinish(); applyVis(); reopenFly(); return; }
    const shown = partsShown(sel);
    const many = shown.length > 1;
    // THE DESIGN TILES OF THIS PART (2026-09-04, the user: "sprinkle back the
    // controls into the shape section ... I can't find the rod setting when
    // clicking on the boom"): design_flow.js knows which macro rows belong
    // to which part and puts them at the head of the column, above the rows.
    if (window.DESIGN_FLOW && window.DESIGN_FLOW.renderTilesFor)
      window.DESIGN_FLOW.renderTilesFor(rowsEl, sel);
    for (const p of shown) {
      // A PART THAT DOES NOT EXIST IS STILL EMITTED, and then hidden by
      // applyVis — which is where every other existence rule is answered, so
      // there is one place that decides what is on screen rather than two.
      //
      // When several parts are shown at once (an assembly, or the root), each
      // one's name heads its own block, so the column still says what you are
      // looking at.
      if (many && (p.groups || []).length) {
        const h = document.createElement('div');
        h.className = 'edH edHP';
        h.innerHTML = '<span></span><i></i>';
        h.firstChild.textContent = nameOf(p);
        // a part heading folds THE PART — every group under it — which is what
        // makes an assembly (or the root, at 649 rows) readable at all
        secWire(h, p.key, null);
        headParts.add(p.key);
        rowsEl.appendChild(h);
        groupsOf.push({ head: h, part: p, group: null, rows: [] });
      }
      // A PART THAT IS NOT A SET OF SLIDERS (2026-09-05). The energy layer's
      // controls are a LIST — you add a tank, you remove one, and each carries
      // its own rows — so there is no fixed set of parameters for the table to
      // claim and no row for `emit` to move. The part names a global that owns
      // its column whole and hands back one element, which is exactly the
      // shape the reference plane's root already has. The parking loop removes
      // it on the next render (it is not `.r`), and the provider hands back
      // the same element again: detached, never destroyed.
      if (p.panel) {
        const prov = window[p.panel];
        const el = prov && prov.panel && prov.panel();
        if (el) emitEls(p, nameOf(p), [el], null, true);
        continue;
      }
      // THE COMMON TRUNK — P8 §5's placement strip, widened (2026-09-03, the
      // user: "identify the common trunk in all the controls and group them
      // appropriately. Right now, essential controls live alongside
      // dispensable controls. We don't hide anything, but we re-order").
      // Every part opens with the same four questions in the same order, each
      // a heading only when the part has an answer to it:
      //
      //   fitted     the switch                                  (`on`)
      //   type       the discrete choices that drive the rest, then how many
      //                                                    (`type`, `count`)
      //   position   fore / aft · in / out · up / down   (`fore`, `out`, `up`)
      //              — the anchor it is placed against is the heading's meta
      //   size       length · width · height             (`len`, `wide`, `high`)
      //
      // Then the part's own groups in the table's order, with the trunk rows
      // taken out of them: RE-PRESENTED, never duplicated. The rows keep their
      // own labels (the glossary rule stands) — the trunk gives them a
      // consistent heading and order, and the layer files were combed so a row
      // in a slot says what the slot says ("fore / aft", "up / down",
      // "in / out", "length", "width", "height") where that is literally what
      // it does, and keeps its domain word in brackets where it is not.
      const trunkKeys = new Set();
      if (p.place) {
        const pl = p.place;
        const L = v => v == null ? [] : (Array.isArray(v) ? v : [v]);
        const trunk = [
          ['fitted',   L(pl.on)],
          ['type',     L(pl.type).concat(L(pl.count))],
          ['position', L(pl.fore).concat(L(pl.out), L(pl.up))],
          ['size',     L(pl.len).concat(L(pl.wide), L(pl.high))],
        ];
        // the anchor says where the part SITS: on the position heading, or on
        // the size heading when the part has no position of its own
        const atOn = trunk[2][1].length ? 'position' : 'size';
        for (const [name, keys] of trunk) {
          if (!keys.length) continue;
          for (const k of keys) trunkKeys.add(k);
          emit(p, name, keys, name === atOn ? pl.at : null, false);
        }
      }
      for (const g of (p.groups || [])) {
        const isExp = g[2] === PT.EXPERT;
        // the trunk rows are re-presented above, not repeated here
        const keys = g[1].filter(k => !trunkKeys.has(k));
        if (keys.length) emit(p, g[0], keys, null, isExp);
      }
    }
    applyVis();
    reopenFly();
  }

  function emit(part, name, keys, meta, expert) {
    const h = document.createElement('div');
    h.className = 'edH';
    h.innerHTML = '<span></span><i></i><em></em>';
    h.children[0].textContent = name;
    h.children[2].textContent = meta || '';
    secWire(h, part.key, name);
    rowsEl.appendChild(h);
    const rows = [];
    for (const r of (extraRows.get(part.key + '/' + name) || []))
      rowsEl.appendChild(r);             // the derived selectors head their group
    for (const k of keys)
      for (const m of (rowsFor.get(k) || [])) {
        rowsEl.appendChild(m.row);         // MOVED, never rebuilt
        rows.push(m);
      }
    groupsOf.push({ head: h, part, group: name, rows, expert: !!expert });
  }

  // =========================================================================
  // THE FINISH VIEW (G103)
  // =========================================================================
  // The same move as the shape view, one level along: it builds no widget. The
  // finish select, the colour well, and the tile / roughness / normal dials are
  // `_cage_ui.js`'s own materials-panel rows, MOVED under the part whose
  // `sections` claim them — so the double-click-the-label reset that clears a
  // section's tint, finish and all three dials at once is the same code here
  // and on the bench, and the game gains no second set of colour pickers to
  // drift from the first.
  //
  // The join is `sections` in the part table, which GATE PARTS already holds
  // true against real builds in both directions: every section a build emits is
  // claimed by exactly one part, and every claim is a section that exists. That
  // gate was written for the 3D highlight; the finish view is the second thing
  // it pays for, and it needed no new rule.
  function emitEls(part, name, els, meta, isPart) {
    if (!els.length) return;
    const h = document.createElement('div');
    h.className = isPart ? 'edH edHP' : 'edH';
    h.innerHTML = '<span></span><i></i><em></em>';
    h.children[0].textContent = name;
    h.children[2].textContent = meta || '';
    // the SECTION key, stable across a rename of the heading (see
    // secShutFinish): a part's own block is 'finish', a shared one keeps its
    // group name, which is already a constant ('livery', 'glazing', ...)
    const secG = isPart ? 'finish' : name;
    secWire(h, part.key, secG);
    rowsEl.appendChild(h);
    for (const el of els) {
      // ...and a row borrowed while it was ALREADY on screen has no home to
      // read off the DOM. The nursery is where every parameter row lives when
      // it is not selected, and the parking loop must not send one back to the
      // column it is being taken out of.
      if (!homeOf.has(el))
        homeOf.set(el, el.parentNode === rowsEl || !el.parentNode
          ? nursery : el.parentNode);
      rowsEl.appendChild(el);
    }
    groupsOf.push({ head: h, part, group: name, secG, rows: [], els,
                    finish: true });
  }

  function renderFinish() {
    const body = CU.MATBODY;
    if (!body) {
      const n = document.createElement('div');
      n.className = 'refNote';
      n.textContent = 'The finish is not in this build.';
      rowsEl.appendChild(n);
      return;
    }
    // the panel's rows, partitioned by the section they are about. Read off the
    // DOM each time rather than cached: buildMatPanel rebuilds the lot whenever
    // the section list changes shape, and CAGE_ON_MAT brings us back here.
    const bySec = new Map(), head = [], glaze = [], lab = [];
    for (const el of Array.from(body.children)) {
      const s = el.dataset && el.dataset.sec;
      if (s) { if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push(el); }
      // `derived` is the bench's read-out of the construction; the live row is
      // taken from the part table below and this would be its dead twin
      else if (el.dataset && el.dataset.matHead === '1')
        (el.dataset.lab ? lab : el.dataset.glaze ? glaze : head).push(el);
    }
    const shown = partsShown(sel);
    const p0 = PT.partByKey[sel];
    const isRoot = !!(p0 && p0.root);
    const taken = new Set();
    // THE WHOLE AEROPLANE'S LIVERY lives on the root and nowhere else. The
    // construction it inherits from, how flown it looks, and the markings on
    // it are not properties of the cowl or of any other part — they are the
    // aeroplane's, and the root is where the aeroplane is selectable.
    if (isRoot) {
      // THE CONSTRUCTION IS NOT IN THE LIVERY ANY MORE (G108, the user: "the
      // construction material and type should definitely be in structure, and
      // not in finish, big mistake").
      //
      // G104 borrowed `intCons` onto the head of this panel, and its reason
      // was sound: the row was unfindable under `Fuselage -> Structure & skin`
      // and the livery showed only its RESULT, a read-out with no way back to
      // the choice. But the fix put a STRUCTURE decision in the FINISH view,
      // and the user's verdict is the one that matters — what it decides is
      // what the aeroplane is MADE OF, not what it looks like.
      //
      // It has a findable home of its own now: `Design & construction`, first
      // under the aeroplane in the structure view, which is what UI-MODEL
      // asked for and what makes both complaints go away at once. The livery
      // keeps the bench's derived read-out suppressed exactly as G104 left it
      // — two rows labelled `construction`, one of them dead, is still worse
      // than either alone.
      emitEls(p0, 'livery', head, 'the whole aeroplane');
      if (glaze.length) emitEls(p0, 'glazing', glaze, 'shared by every pane');
      // THE MATERIAL LAB (G206): the tables themselves, live — the
      // designer's bench, on the root beside the livery, never on a part
      if (lab.length) emitEls(p0, 'material lab', lab,
                              'the finish tables, live — not saved with the aeroplane');
      // FOUR BLOCKS, NOT ONE (G207): the registration, the livery kit, the
      // body image and the wing image each under their own heading, by the
      // `data-dec` tag every row carries
      const dec = CU.DECBODY;
      if (dec) {
        const by = { reg: [], kit: [], body: [], wing: [], stk: [], other: [] };
        for (const el of Array.from(dec.children))
          (by[(el.dataset && el.dataset.dec) || 'other'] || by.other).push(el);
        emitEls(p0, 'registration', by.reg.concat(by.other),
                'the legal marking');
        emitEls(p0, 'livery', by.kit, 'the marking kit — three layers');
        emitEls(p0, 'body image', by.body, 'a picture on the fuselage');
        emitEls(p0, 'wing image', by.wing, 'a picture on the wing');
        // G208.2: the certification stickers' place and fine tuning
        if (by.stk.length)
          emitEls(p0, 'certification stickers', by.stk,
                  'where the bench\'s roundels are worn — a place, then fine tuning');
      }
    }
    // THE GLAZING DIALS FOLLOW THE GLASS (2026-08-31, the user editing the
    // windshield: "I don't have any material options... it's really like it
    // isn't there"). The dials are SHARED — one windscreen and one skylight
    // are the same glass cut twice (G113.2's ruling stands) — but shared
    // must not mean hidden on the root: selecting any part that OWNS a pane
    // brings the one set of rows along. Borrowed once, under the first
    // glass-owning part shown, never duplicated.
    const GLASSSEC = (window.AEROSKIN && window.AEROSKIN.AERO_GLASS) || new Set();
    let glazeDone = false;
    for (const p of shown) {
      const els = [];
      for (const s of (p.sections || [])) {
        const r = bySec.get(s);
        if (!r || taken.has(s)) continue;
        taken.add(s);
        for (const el of r) els.push(el);
      }
      emitEls(p, nameOf(p), els, '', true);
      // A PART WHOSE FINISH IS NOT THE AEROPLANE'S LIVERY (2026-09-05). A tank
      // is an object with a material, not covering: it wears no finish, no
      // markings and no wear, so it claims no `sections` and there is nothing
      // here for `bySec` to hand it. What it does have is a surface the
      // builder picks — the scanned set, the paint hue and the tint — and the
      // layer that owns them hands them over whole, exactly as `panel` does in
      // the shape view one function up. The part names the global; nothing
      // about vessels is known here.
      if (p.panelFinish) {
        const prov = window[p.panelFinish];
        const fel = prov && prov.panelFinish && prov.panelFinish();
        if (fel) emitEls(p, nameOf(p), [fel], 'one block per tank', true);
      }
      if (!isRoot && !glazeDone && glaze.length &&
          (p.sections || []).some(s => GLASSSEC.has(s))) {
        glazeDone = true;
        emitEls(p, 'glazing', glaze, 'shared by every pane');
      }
    }
    // ANYTHING THE TABLE HAS NOT CLAIMED still gets a home. GATE PARTS says
    // there is nothing here on a build it knows; a layer added since is a row
    // the player can still reach rather than a control that silently vanished.
    if (isRoot) {
      const rest = [];
      for (const [s, r] of bySec) if (!taken.has(s)) for (const el of r) rest.push(el);
      emitEls(p0, 'unclaimed', rest, 'not yet in the part table');
    }
    // A PART WITH NO SECTION IS NOT A PART WITH NO MATERIAL. The cage's skin
    // is sectioned off its own mesh groups, and the layer surfaces the
    // builder paints — wing, tips, control surfaces, fin, rudder, stab —
    // are declared sections too (AEROSKIN's AERO_SEC), each following its
    // parent's livery until overridden. What remains here is HARDWARE,
    // whose finishes are declared in AERO_HARD and are not the builder's to
    // pick (a tyre is rubber and a chromed oleo piston is chrome). So the
    // note says where the finish DOES come from, and takes you there.
    if (!rowsEl.children.length) {
      const n = document.createElement('div');
      n.className = 'refNote';
      n.textContent = 'No finish of its own. Its skin follows the aeroplane\'s ' +
        'construction, and its fittings are fixed hardware materials.';
      const b = document.createElement('button');
      b.className = 'pill';
      b.textContent = 'the aeroplane\'s livery';
      b.onclick = () => select('craft');
      n.appendChild(b);
      rowsEl.appendChild(n);
    }
  }

  function setView(v) {
    view = ['finish', 'design'].includes(v) ? v : 'shape';
    pref(LS_VIEW, view);
    wrap.classList.toggle('fin', view === 'finish');
    // G153: and DESIGN carries its own class for the same reason FINISH does —
    // the tiles are the whole aeroplane's, so there is no selected part to
    // reset and no expert rows among them. The two pills were left visible and
    // INERT here (named at G129), which is a control that lies about what it
    // will do.
    wrap.classList.toggle('des', view === 'design');
    const a = $('edTabShape'), b = $('edTabFinish'), c = $('edTabDesign');
    if (a) a.classList.toggle('on', view === 'shape');
    if (b) b.classList.toggle('on', view === 'finish');
    if (c) c.classList.toggle('on', view === 'design');
    // the transient design fold — see partsAuto's own note
    partsAuto = view === 'design';
    wrap.classList.toggle('pcol-off', partsAway());
    layoutRight();
    render();
    syncCowlGhost();
  }

  // =========================================================================
  // VISIBILITY — the last word, after _cage_ui's own pass
  // =========================================================================
  // A moved row is out of reach of the group-level `when`/`level` rules that
  // used to hide it, so this reapplies them: the group rules it inherited, the
  // part's own existence rule, and the expert switch (declared per GROUP in
  // the part table, which is what `don't touch` became).
  function applyVis() {
    if (!CU) return;
    rebaseCheck();
    const P = CU.P, ex = CU.EXPERT && CU.EXPERT.on;
    // TWO WRITES, AND ONLY WHEN THE LAST ROW MOVED. applyVis runs at the end
    // of every build; a class toggle on 537 unchanged rows is what turns a
    // drag into a stutter (see the note on `display` below).
    const endsWith = (g, el) => {
      if (g.endRow === el) return;
      if (g.endRow) g.endRow.classList.remove('endg');
      if (el) el.classList.add('endg');
      g.endRow = el;
    };
    // the changed set, computed ONCE per pass and read by every badge and by
    // `reset part`. It covers every row, not just the ones on screen, because
    // the tree's dots are about parts you are not looking at.
    dirty.clear();
    for (const [k, ms] of rowsFor) if (dirtyOf(ms[0], P)) dirty.add(k);
    let changedHere = 0;
    for (const g of groupsOf) {
      let live = 0;
      const partOk = exists(g.part);
      // THE FOLD, in two questions: is the PART this group belongs to rolled
      // up (only askable when its heading is on screen), and is this group?
      const isPartHead = g.group === null;
      const underShut = !isPartHead && headParts.has(g.part.key) &&
                        secShut(g.part.key, null, 0);
      // THE ONE ROW A SWITCHED-OFF PART KEEPS (see `gateRow` above): its own
      // switch, so the part can be put back. Null while the part is on — the
      // switch is then just another of its rows and follows the normal rules.
      const gateK = partOk ? null
        : ((g.finish || !g.part.gate) ? null
           : (gateRow(g.part) ? g.part.gate : null));
      // A FINISH GROUP HAS NO ROWMETA. Its elements are the materials panel's,
      // which carry no `when` and no key — the only rule that reaches them is
      // whether the part they describe is on this aeroplane at all.
      if (g.finish) {
        const shut = underShut || secShutFinish(g.part.key, g.secG || g.group);
        const want = (partOk && !shut) ? '' : 'none';
        for (const el of g.els) if (el.style.display !== want) el.style.display = want;
        g.head.classList.toggle('hide', !partOk || underShut);
        secPaint(g.head, shut, g.els.length);
        endsWith(g, (partOk && !shut && g.els.length)
          ? g.els[g.els.length - 1] : null);
        continue;
      }
      // THE RULE GOES AT THE END OF THE SECTION, never after its head (the
      // user: "you put vertical separators after a head of section, it is
      // very unclear"). Which row is last is not a static fact — expert rows,
      // `when` rules and part existence all move it — so it is decided here,
      // where visibility is already being decided, and nowhere else.
      // EXISTENCE FIRST, THEN THE FOLD, in two passes over the group's rows —
      // because the fold's own default is a function of how many rows EXIST,
      // and that is not known until the first pass has run. Reads are cheap;
      // it is the writes below that a drag cannot afford.
      const vises = [];
      for (const m of g.rows) {
        let vis = (partOk || m.k === gateK) && !(g.expert && !ex);
        if (vis) {
          const o = m.opts || {};
          if (o.level === 'expert' && !ex) vis = false;
          if (vis && o.when) { try { vis = !!o.when(P); } catch (e) {} }
        }
        if (vis) for (const w of (inherited.get(m.row) || [])) {
          try { if (!w(P)) { vis = false; break; } } catch (e) {}
        }
        vises.push(vis);
        if (vis) live++;
      }
      const shut = isPartHead ? secShut(g.part.key, null, 0)
        : (underShut || secShut(g.part.key, g.group, live));
      let lastVis = null;
      for (let i = 0; i < g.rows.length; i++) {
        const m = g.rows[i], vis = vises[i];
        // WRITE ONLY WHEN IT CHANGED. This runs at the end of every build, and
        // a build happens on every pixel of a slider drag — with the root
        // selected that is 649 rows. Style and class writes on unchanged
        // values are what turn a drag into a stutter.
        //
        // Compared against the DOM, not against a remembered value: _cage_ui's
        // own applyRowVis has just written display on every row that carries
        // its own `when`, and a cache would happily agree with itself while
        // the element said something else.
        const want = (vis && !shut) ? '' : 'none';
        if (m.row.style.display !== want) m.row.style.display = want;
        if (!vis) continue;
        // THE CHANGED DOT (P8 §6) — see `dirtyOf` and the note above it. It
        // is about the ROW, not about whether you can currently see it: a
        // rolled-up section still counts toward the part's dot.
        const chg = dirty.has(m.k);
        if (m.row.classList.contains('chg') !== chg)
          m.row.classList.toggle('chg', chg);
        if (chg) changedHere++;
        if (!shut) lastVis = m.row;
      }
      endsWith(g, lastVis);
      secPaint(g.head, shut, live);
      // a heading with nothing under it is a heading about nothing. Part
      // headings (group === null) follow their part instead — and a group
      // whose part is rolled up goes with the part.
      g.head.classList.toggle('hide',
        isPartHead ? (!partOk && !gateK) : (live === 0 || underShut));
    }
    // THE REFERENCE'S GAP FOLLOWS THE BUILD. applyVis is the end of every
    // build and every syncSliders, which is exactly when the geometry the
    // discrepancy line was measured against has been replaced.
    { const r = rootFor(sel); if (r && r.refresh) r.refresh(); }
    const cEl = $('edChanged');
    if (cEl) cEl.textContent = changedHere ? changedHere + ' changed' : '';
    secAllLabel();
    paintTree();
    paintInfo();
    // THE HIGHLIGHT IS REBUILT WITH THE AEROPLANE. The cage's geometry and
    // every layer's group are thrown away and remade on each build, and the
    // overlay hangs off both — so it has to be remade with them, or the tint
    // silently belongs to a mesh that no longer exists.
    hiBuild(sel === 'craft' ? null : sel, 'sel');
    // ...AND SO IS THE PIN, for the same reason and one better: the row it
    // names is the row being DRAGGED, so the dot walks the corner it is
    // moving instead of standing where the corner used to be.
    pinBuild(pinKey);
    hovKey = null; hovInst = ''; hiClear('hov');
  }

  // THE NAME CHIP. The aeroplane's own name — the one you typed on the shelf,
  // which G65 made the same string as `spec.meta.name` — and the one-line
  // provenance the game card already builds. Read off those two rather than
  // re-derived: a second place that computes "what is this aeroplane" is a
  // second place that can disagree with the plaque.
  function paintInfo() {
    const n = $('edName'), s = $('edSpec');
    if (!n) return;
    let name = '';
    try { name = (window.GARAGE_SPEC && window.GARAGE_SPEC.name()) || ''; }
    catch (e) {}
    const card = document.getElementById('acName');
    n.textContent = name || (card && card.textContent) || 'Garage build';
    const spec = document.getElementById('acSpec');
    if (s) s.textContent = (spec && spec.textContent) || '';
  }

  // =========================================================================
  // THE TREE
  // =========================================================================
  // Redrawn only when its SHAPE changes — which parts exist, and what they are
  // called. That is a real signature, not an optimisation for its own sake:
  // this runs after every build, and a build happens on every pixel of a
  // slider drag.
  function paintTree() {
    if (!CU || !treeEl) return;
    const rows = [];
    // THE ROOTS ARE THE TREE'S TOP LEVEL, in registration order, and each
    // one that says so brings its branch with it. They were two hard-coded
    // rows before, in two different name styles.
    const partRoot = PT.CAGE_PARTS.filter(p => p.root)[0];
    const walk = (parent, lvl) => {
      for (const p of PT.CAGE_PARTS) {
        if (p.root || p.parent !== parent) continue;
        if (!inTree(p)) continue;
        rows.push({ p, lvl, name: nameOf(p), kids: hasKids(p.key),
                    off: switchedOff(p) });
        // a FOLDED assembly keeps its own row and hides what is under it
        if (folded.has(p.key)) continue;
        walk(p.key, lvl + 1);
      }
    };
    const hasKids = k => PT.CAGE_PARTS.some(c => c.parent === k && inTree(c));
    for (const r of ROOTS) {
      const p = (r.parts && partRoot)
        ? Object.assign({}, partRoot, { name: r.name })
        : { key: r.key, name: r.name, root: true };
      rows.push({ p, lvl: 0, name: r.name, rootDef: r,
                  kids: !!(r.parts && partRoot) });
      if (r.parts && !folded.has(r.key)) walk(null, 0);
    }
    // THE SELECTION FOLLOWS THE AEROPLANE. Turn the mirrored pod off while the
    // aft deck is selected and that part stops existing — the tree drops it and
    // the inspector would go on heading a column of nothing. Fall back up the
    // parents until something that is still on the aeroplane.
    if (!rows.some(r => r.p.key === sel) && !rootFor(sel)) {
      // A FOLDED BRANCH IS NOT A MISSING PART, and the difference started
      // mattering the day clicking the covering began selecting the BAY you
      // clicked: the bays live under `Fuselage`, and with that branch folded
      // every click on the fuselage answered `Fuselage` — the walk below did
      // exactly what it was written to do, to a part that was there all
      // along. So a row that is only OUT OF SIGHT opens its folds, and the
      // walk keeps the case it exists for: a part that has stopped EXISTING.
      const chain = [];
      for (let a = PT.partByKey[sel]; a && inTree(a);
           a = a.parent ? PT.partByKey[a.parent] : null) chain.push(a);
      const whole = chain.length && chain[chain.length - 1].parent === null;
      const branch = ROOTS.filter(r => r.parts).map(r => r.key);
      if (whole && chain.concat(branch.map(k => ({ key: k })))
                        .some(p2 => folded.has(p2.key))) {
        for (const p2 of chain) folded.delete(p2.key);
        for (const k of branch) folded.delete(k);
        saveFolded();
        treeSig = '';
        paintTree();
        return;
      }
      let up = PT.partByKey[sel];
      while (up && up.parent && !rows.some(r => r.p.key === up.key))
        up = PT.partByKey[up.parent];
      select(up && rows.some(r => r.p.key === up.key) ? up.key : 'craft');
      return;
    }
    const badges = rows.map(r => (r.rootDef && r.rootDef.badge)
      ? (r.rootDef.badge() || '') : partBadge(r.p));
    const sig = rows.map((r, i) => r.p.key + r.lvl + r.name + badges[i] +
      (folded.has(r.p.key) ? '>' : '') + (r.off ? '-' : '') +
      (!r.p.root && i + 1 < rows.length && rows[i + 1].p.root ? '_' : ''))
      .join('|') + '#' + sel;
    if (sig === treeSig) return;
    treeSig = sig;
    treeEl.textContent = '';
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      // A ROOT'S BRANCH ENDS WITH A RULE, and the root itself is not followed
      // by one. The rule used to sit under the root row, which put a
      // separator between a head and the very thing it heads. `edEnd` is the
      // last row BEFORE the next root; the last row of the tree gets nothing,
      // because the end of the list is already an end.
      const ends = !r.p.root && i + 1 < rows.length && rows[i + 1].p.root;
      // THE TYPE LADDER STOPS AT THREE RUNGS (asm / part / leaf); THE INDENT
      // DOES NOT (G187, the user: "deeper, more indented"). A fourth level
      // used to sit flush with the third and read as its sibling.
      d.style.setProperty('--lv', r.lvl);
      d.className = 'edN lv' + Math.min(2, r.lvl) +
        (r.p.root ? ' root' : '') + (ends ? ' edEnd' : '') +
        (r.off ? ' edOff' : '') +
        (r.p.key === sel ? ' on' : '');
      d.tabIndex = 0;
      d.dataset.p = r.p.key;
      // THE DISCLOSURE, on any row that has something under it. It TOGGLES and
      // does not select: a fold is about what you can see, not about what you
      // are editing, and conflating the two means you cannot put a branch away
      // without also leaving the row you were working on.
      if (r.kids) {
        const t = document.createElement('u');
        t.className = 'fold';
        t.textContent = folded.has(r.p.key) ? '▸' : '▾';
        t.onclick = e => {
          e.stopPropagation();
          if (folded.has(r.p.key)) folded.delete(r.p.key); else folded.add(r.p.key);
          saveFolded(); treeSig = ''; paintTree();
        };
        d.appendChild(t);
      } else {
        const t = document.createElement('u');
        t.className = 'fold none';
        d.appendChild(t);
      }
      const s = document.createElement('span');
      s.textContent = r.name;
      // A SWITCHED-OFF PART SAYS SO ON ITS OWN ROW. Dimming alone reads as
      // "disabled, don't bother"; the point of keeping the row is that this
      // is the one place you CAN bother.
      s.title = r.off ? r.name + ' — not fitted' : r.name;
      d.appendChild(s);
      if (badges[i]) {
        const b = document.createElement('i');
        b.textContent = badges[i];
        d.appendChild(b);
      }
      d.onclick = () => select(r.p.key);
      d.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r.p.key); }
      };
      // THE OTHER DIRECTION (G79). Pointing at a row lights the geometry, so
      // the tree can be read against the aeroplane without clicking through
      // thirty parts to find out what "Taper section" is.
      d.onmouseenter = () => {
        if (r.p.key === sel) return;
        hovKey = r.p.key;
        hiBuild(r.p.key, 'hov');
      };
      d.onmouseleave = () => {
        if (hovKey !== r.p.key) return;
        hovKey = null; hiClear('hov');
      };
      treeEl.appendChild(d);
    });
  }

  // one dot per changed row on that part and everything under it, capped at
  // three — a column of eleven dots says nothing a column of three does not
  function partBadge(p) {
    const n = Math.min(3, changedKeys(p.key).length);
    return n ? '●'.repeat(n) : '';
  }

  // every key of a part (and everything under it) that has really moved.
  // Reads the set applyVis has just computed rather than re-testing 537 rows
  // per tree line: this runs once per part per build, and a build happens on
  // every pixel of a slider drag.
  const changedKeys = key => {
    const out = [];
    if (!dirty.size) return out;
    for (const q of partsShown(key)) {
      // A PART THAT IS NOT ON THE AEROPLANE DOES NOT COUNT. Turning the
      // mirrored pod on and off again leaves every `aft*` sentinel holding the
      // one-shot copy the FOREVER-SPLIT ruling made of the front — twenty-two
      // rows that differ from the design you loaded and that you cannot see,
      // reach, or reset. A dot for them is a dot with nowhere to click.
      //
      // ...WITH ONE ROW'S EXCEPTION: a part collapsed to its own switch shows
      // that switch, so the switch can still earn a dot. Having turned the fin
      // off, the dot beside `Fin & rudder` is the thing that says the change
      // is yours and where to undo it — the rest of its rows stay silent
      // exactly as the paragraph above requires.
      const on = exists(q);
      if (!on && !switchedOff(q)) continue;
      for (const k of PT.cagePartParams(q)) {
        if (!on && k !== q.gate) continue;
        if (dirty.has(k)) out.push(k);
      }
    }
    return out;
  };

  function select(key) {
    // THE REFERENCE PLANE IS THE ONE ROW THAT IS NOT A PART (G90). It is a
    // second ROOT beside the aeroplane's, and it is deliberately NOT in
    // CAGE_PARTS: the part table is the declared assembly of the aeroplane
    // YOU ARE BUILDING, GATE PARTS holds it to exactly that, and a reference
    // aeroplane is not made of any of it. So the guard admits one key the
    // table does not know, and every helper below already returns empty for
    // an unknown key — partsShown, changedKeys and hiBuild all resolve
    // through partByKey and come back with nothing, which is the right
    // answer and needed no edit anywhere.
    const rdef = rootFor(key);
    if (!rdef && !PT.partByKey[key]) return;
    // a root that was showing stops showing
    { const was = rootFor(sel);
      if (was && was !== rdef && was.shown) was.shown(false); }
    sel = key;
    pref(LS_SEL, key);
    // A ROOT THAT BUILDS ITS OWN PANEL HAS NO TWO VIEWS. The shape/finish
    // split is the aeroplane's — the reference plane is a display, the shed is
    // a room, and neither has a livery you can paint.
    wrap.classList.toggle('noview', !!(rdef && rdef.panel));
    if (rdef && rdef.panel) {
      $('edPartName').textContent = rdef.name;
      $('edCrumb').textContent = '';
      const rm = $('edPartMeta');
      if (rm) rm.textContent = rdef.meta || '';
      treeSig = '';
      render();
      syncCowlGhost();
      return;
    }
    const p = PT.partByKey[key];
    $('edPartName').textContent = nameOf(p);
    $('edCrumb').textContent = crumbFor(key);
    const meta = $('edPartMeta');
    if (meta) meta.textContent = p.sections && p.sections.length
      ? p.sections.join(' · ')
      : (p.layer ? p.layer + ' layer' : '');
    treeSig = '';                          // the selection mark moved
    render();
    syncCowlGhost();
  }


  // =========================================================================
  // THE COWL GETS OUT OF THE WAY
  // =========================================================================
  // The user: "when editing the livery of the engine, the cowl should
  // automatically be set to transparent, or almost."
  //
  // G113.4 gave the engine three paintable sections and left the obvious
  // complaint standing in its own handover: the paint is invisible under a
  // closed cowl, and a control that is correct and unseeable disappoints like
  // one that does nothing. This is the answer, and it is a VIEW change and
  // nothing else — the same `cowl α` dial G29 built for exactly this ("see the
  // engine through the shell"), DRIVEN rather than duplicated. Nothing here
  // touches the spec, and the join already resets the row to 1 for flight
  // (VIEW_STATE, `{ row: 'cowl α', to: 1 }`), so a ghosted cowl cannot fly.
  const COWL_GHOST = 0.15;            // "transparent, or almost"
  let cowlWas = null;                 // the builder's own value, while borrowed
  let ghosting = false;               // declared BEFORE its reader, not after

  function syncCowlGhost() {
    if (!CU || !window.CAGE_VIEW || ghosting) return;
    const V = window.CAGE_VIEW;
    // ONLY WHERE THE PAINT IS. The livery view is where a finish is picked;
    // in the structure view the cowl is context you are working against.
    const want = view === 'finish' && sel === 'engine' && !!+CU.P.cowlOn;
    if (want === (cowlWas !== null)) return;      // already in the right state
    const before = V.cowlA;
    if (want) {
      // ALREADY SEEING THROUGH IT? LEAVE IT ALONE. Taking a dial the builder
      // has already set further than we would is not help, and restoring it
      // afterwards would be worse.
      if (!(V.cowlA > COWL_GHOST)) return;
      cowlWas = V.cowlA;
      V.cowlA = COWL_GHOST;
    } else {
      // IF THE BUILDER MOVED IT WHILE WE HELD IT, IT IS THEIRS NOW. Restoring
      // over a deliberate drag would be the borrow refusing to give the dial
      // back — so only the value we ourselves wrote is taken away again.
      if (V.cowlA === COWL_GHOST) V.cowlA = cowlWas;
      cowlWas = null;
    }
    if (V.cowlA === before) return;               // nothing to redraw
    showAlpha('cowl α', V.cowlA);
    ghosting = true;
    try { CU.build(); } finally { ghosting = false; }
  }

  // THE SLIDER MUST NOT LIE. `cowl α` is a row the builder can see and drag,
  // and moving the value underneath it without moving the control is how a
  // panel starts disagreeing with the thing it controls. `_cage_ui`'s own
  // handler writes both halves on input; a programmatic change has to as well.
  function showAlpha(label, v) {
    const row = labelIndex().get(label);
    if (!row) return;
    const i = row.querySelector('input[type=range]');
    const t = row.querySelector('span.v');
    if (i) i.value = v;
    if (t) t.textContent = (+v).toFixed(2);
  }

  // =========================================================================
  // RESET, EXPERT, COLLAPSE
  // =========================================================================
  // PER-PART RESET (P8 §6). Every row of the selected part goes back to the
  // loaded design — the same target the per-row double-click has used since
  // G27, applied to a part. It is the one gesture that was missing: undoing
  // twenty small changes to a cowl meant twenty double-clicks.
  function resetPart() {
    if (!CU || !myBase) return;
    const keys = changedKeys(sel);
    if (!keys.length) return;
    for (const k of keys) CU.setParam(k, myBase[k]);
    CU.syncSliders();
    CU.build();
  }

  function setExpert(on) {
    if (!CU || !CU.EXPERT) return;
    CU.EXPERT.on = !!on;
    // the same key the bench's own switch has always written, so the two
    // surfaces agree about a preference that is about the person, not the page
    pref('cageExpert', on ? '1' : '0');
    const b = $('edExpert');
    if (b) b.classList.toggle('on', !!on);
    CU.applyRowVis();
    // TAIL CHANTIER 2 P2: the fin's control cage follows this switch (it is
    // what the expert rows move), and the cage is drawn at build time
    if (CU.P && +CU.P.finOn && typeof CU.build === 'function') CU.build();
  }

  // ONE PLACE MEASURES THE RIGHT PANEL. It is two columns that fold
  // independently, so it has four widths, and four widths written out as four
  // CSS classes is three chances to get the fourth wrong. The panel's own
  // width and the render's inset are the same number and come from here.
  const PROPS_W = 390, PARTS_W = 250, SPINE = 46;
  function layoutRight() {
    const w = (propsOff ? SPINE : PROPS_W) + (partsAway() ? SPINE : PARTS_W);
    wrap.style.width = w + 'px';
    if (typeof api.panelWidth === 'function') api.panelWidth(w);
  }
  function setCollapsed(on) {
    collapsed = !!on;
    pref(LS_COL, collapsed ? '1' : '0');
    // opening the column mid-design lifts the transient fold too, or the
    // spine click would be a click that does nothing
    if (!collapsed) partsAuto = false;
    wrap.classList.toggle('pcol-off', partsAway());
    layoutRight();
  }
  // THE SLIDERS FOLD TOO (the user: "the slider panel should also be
  // minimizable, to get a good shot of the plane and full view"). With all
  // three surfaces folded the chrome is three 46 px spines and the render has
  // the rest of the screen, which is what a screenshot of an aeroplane wants.
  function setPropsOff(on) {
    propsOff = !!on;
    pref(LS_PROP, propsOff ? '1' : '0');
    wrap.classList.toggle('prop-off', propsOff);
    layoutRight();
  }

  // =========================================================================
  // THE VIEW OWNS LOOKING (G78)
  // =========================================================================
  // An icon rail over the render, one flyout per question you can ask about
  // HOW YOU LOOK at the build. Its contents are, again, _cage_ui.js's own row
  // elements — moved out of the accordion's `view` and `polycount` groups and
  // out of the room's `hangar` group — so `cage`, `wireframe`, `sections`,
  // `subsurf`, the family alphas, `explode`, `cutaway` and the dims box keep
  // their behaviour exactly and gain a home that says what they are for.
  //
  // The rows are found BY THEIR LABEL. That reads as fragile and is the least
  // fragile thing available: the alternative is index arithmetic over a list
  // three other files push into, and a label that changes makes a control land
  // in the overflow section rather than vanish. Anything not claimed here is
  // still reachable under `materials & extras`.
  const RAIL = [
    { k: 'camera', label: 'camera', title: 'How the build is framed',
      icon: 'M4 5.5h2.2l1-1.5h3.6l1 1.5H14a1 1 0 0 1 1 1V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z|M9 11.6a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z' },
    { k: 'display', label: 'display', title: 'What the build is drawn as',
      icon: 'M1.6 9S4.4 4.2 9 4.2 16.4 9 16.4 9 13.6 13.8 9 13.8 1.6 9 1.6 9Z|M9 11.1a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2Z',
      // `subsurf` is deliberately absent (G106.1): it is a bench instrument
      // and the game pins it at 2. See VIEW_STATE in tools/_cage_join.js —
      // GATE VIEW holds this list and that table against each other.
      // `selection` (G131) is the editor's own parked row — the highlight
      // style, three ways to say "this part". Exempt in VIEW_KEEP: an edHi
      // overlay, and the capture skips those.
      // `smoothing` (G144) is the third parked row: the resolve pass's tier.
      // Exempt in VIEW_KEEP — it is a RENDERER setting and moves no vertex.
      rows: ['selection', 'clicking', 'smoothing', 'see inside',
             'control cage', 'wireframe', 'section colours', 'curvature heat',
             'surface field', 'template step', 'canopy loops',
             'glass α', 'fuselage α', 'int skin α', 'structure α', 'cowl α'] },
    // 'the light in the shed' is now the light EVERYWHERE: the shed's lamps,
    // the sky outside the door and what it does to the ground, one flyout —
    // because the question a player actually asks — why does it look like that
    // out there and not in here? — is about the pair, not either one.
    // `label` is the resting fallback only: syncNightLabel writes the current
    // mood's own name over it (G136).
    { k: 'night', label: 'night', title: 'The light, in here and out there',
      icon: 'M14.2 11.1A5.8 5.8 0 0 1 6.9 3.8a5.8 5.8 0 1 0 7.3 7.3Z',
      // THE RAIL BORROWS, THE TREE OWNS. These four rows live in the shed's
      // hangar group (the world root retired at G136), and this flyout shows
      // them because looking is what the rail is for. borrow()/returnRows()
      // put each one back where it came from.
      rows: ['time of day', 'lights', 'world lights', 'ground bounce'] },
    { k: 'explode', label: 'explode', title: 'The build, taken apart',
      icon: 'M9 2.4v4.2|M9 11.4v4.2|M2.4 9h4.2|M11.4 9h4.2|M7.4 7.4h3.2v3.2H7.4z',
      rows: ['explode', 'cutaway'] },
    { k: 'measure', label: 'measure', title: 'What the build measures',
      icon: 'M2.6 6.4h12.8v5.2H2.6z|M5.4 6.4v2.2|M8.2 6.4v3|M11 6.4v2.2|M13.8 6.4v3',
      rows: ['dims box'] },
    // G200: THE CONTROLS — the mapping panel, from the shed too (the user's
    // ruling: "triggered from both environments"). LITERAL FIELDS ONLY: GATE
    // VIEW reads this table in an empty vm, and `controls` is not one of the
    // MESH_FLYOUTS it holds against the capture. openFly builds it by name,
    // as it does `camera`.
    { k: 'controls', label: 'controls', title: 'How you fly it',
      icon: 'M9 10.6V4.2|M9 4.2a1.3 1.3 0 1 0 0-.1|M5 15.4h8a1.4 1.4 0 0 0 1.4-1.4V12a1.4 1.4 0 0 0-1.4-1.4H5A1.4 1.4 0 0 0 3.6 12v2a1.4 1.4 0 0 0 1.4 1.4Z' },
    // G255: THE LEGEND — what the marks standing in the room mean (the
    // amber and cyan posts, the bar between them, the wheel crosses), where
    // the balance point should sit and how to move it. On demand, the user's
    // ruling ("let's not pollute our interface too much"). A question-mark
    // glyph. LITERAL FIELDS ONLY (GATE VIEW reads this table in a vm).
    // G286: GRAPHICS - the same settings menu the flight rail opens (the
    // user: "in the editor and in flight"). LITERAL FIELDS ONLY (GATE VIEW
    // reads this table in a vm); openFly builds it by name. (GFX)
    { k: 'graphics', label: 'graphics', title: 'How much the card draws',
      icon: 'M3 5.2h12|M3 9h12|M3 12.8h12|M6.4 5.2a1.3 1.3 0 1 0 0-.1|M11.2 9a1.3 1.3 0 1 0 0-.1|M7.6 12.8a1.3 1.3 0 1 0 0-.1' },
    { k: 'legend', label: 'legend', title: 'What the marks in the room mean',
      icon: 'M9 15.4A6.4 6.4 0 1 0 9 2.6a6.4 6.4 0 0 0 0 12.8Z|M6.9 7.2a2.1 2.1 0 1 1 3 1.9c-.6.3-.9.7-.9 1.4v.4|M9 13.1v.1' },
  ];
  let flyOpen = null;

  function buildRail() {
    const rail = $('edRail');
    if (!rail || rail.children.length) return;
    for (const t of RAIL) {
      const b = document.createElement('button');
      b.className = 'edRailBtn';
      b.dataset.f = t.k;
      b.title = t.title;
      b.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true">' +
        t.icon.split('|').map(d => '<path d="' + d + '"/>').join('') +
        '</svg><span></span>';
      b.querySelector('span').textContent = t.label;
      b.onclick = () => openFly(flyOpen === t.k ? null : t.k);
      rail.appendChild(b);
    }
    syncNightLabel();
  }

  // THE BUTTON SAYS WHAT TIME IT IS (G136, the user: "the main UI always says
  // night as a button, while it should pick the current setting"). The flyout
  // stays the switchboard; the button under it wears the current mood's own
  // name — `dusk`, `overcast` — so the rail states the setting instead of one
  // arbitrary value of it. Two triggers: the mood select's change event
  // (addEventListener — its onchange belongs to _cage_ui), and every
  // fillRoots, because a mood can arrive without that event firing (a hangar
  // swap, a payload's own default).
  function syncNightLabel() {
    const rail = $('edRail');
    if (!rail) return;
    let btn = null;
    for (const b of rail.children) if (b.dataset.f === 'night') btn = b;
    if (!btn) return;
    const GE = window.GARAGE_ENV;
    let name = 'night';                    // the resting fallback, pre-garage
    if (GE && GE.moods) {
      const n = (GE.moods() || [])[GE.mood() | 0];
      if (n) name = String(n).toLowerCase();
    }
    const s = btn.querySelector('span');
    if (s && s.textContent !== name) s.textContent = name;
  }
  // ...found through labelIndex, not through the hangar group: the rail has
  // already parked `time of day` in the nursery as one of its own rows.
  let moodHooked = false;
  function hookMoodSelect() {
    if (moodHooked) return;
    const r = labelIndex().get('time of day');
    const s = r && r.querySelector('select');
    if (s) { s.addEventListener('change', syncNightLabel); moodHooked = true; }
  }

  // =========================================================================
  // THE QUICK ACTIONS (2026-09-03) — three questions, one click each
  // =========================================================================
  // The user: "promote the view interior option into a quick action bar,
  // that's a new one floating on top of the editor screen. Over there, we
  // will also have a button for alternating the reference plane views
  // (disabled if no reference plane is selected). We'll also have a single
  // button alternating between interior and exterior views... another single
  // button cycling through the time of day".
  //
  // THE BAR PRESSES ROWS; IT OWNS NOTHING. `act` reaches the control that
  // already exists and fires its own event — the `see inside` checkbox
  // _cage_ui built, the `time of day` select, the reference panel's cut — so
  // there is still exactly one element per decision and exactly one handler
  // on it, and `view` READS the same place back. A button keeping its own
  // copy would be a second source of truth for a fact the panel also states,
  // which is the trap the rail's borrow rule exists to avoid.
  //
  // `row` NAMES THE CONTROL IT PRESSES, and GATE VIEW reads this table to
  // require that the rail offers that row too: the bar is a SHORTCUT, never a
  // new control, so every quick action inherits its row's capture decision
  // (`see inside` is neutralised in VIEW_STATE — an aeroplane captured
  // see-through would fly see-through). An entry with no row names the
  // `state` it drives instead and says why that is not a rail row.
  //
  // THE ICON IS THE STATE, not the effect — G136's ruling for the night
  // button, in glyphs — so the bar reads as a status line you can press. Each
  // icon is raw inner-SVG on the rail's own 18x18 grid, richer than RAIL's
  // path list because these need a dash pattern to say "see-through".
  const QI = {
    // a cabin section: the arch of the shell standing on its floor
    shell: 'M3.1 12.7V9.2a5.9 5.9 0 0 1 11.8 0v3.5z',
    seat: 'M7.3 11.9V8.4h1.2M7.3 11.9h3.4',
  };
  const QUICK = [
    // ---- inside / outside -------------------------------------------------
    { k: 'inside', row: 'see inside',
      view: () => {
        const on = !!(window.CAGE_VIEW && window.CAGE_VIEW.xray);
        return { on,
          title: on
            ? 'Interior view — the covering is see-through, and you can ' +
              'click straight through it to the engine, the seats and the panel'
            : 'Exterior view — the aeroplane as it is covered',
          // OUTSIDE the shell is closed; INSIDE the same shell is dashed and
          // the seat behind it shows, which is what the switch does.
          icon: on
            ? '<path d="' + QI.shell + '" stroke-dasharray="2.3 1.9"/>' +
              '<path d="' + QI.seat + '"/>'
            : '<path d="' + QI.shell + '"/>' };
      },
      act: () => {
        const c = $('xray');
        if (!c) return;
        c.checked = !c.checked;
        c.dispatchEvent(new Event('change'));
      } },
    // ---- the reference plane's cut ----------------------------------------
    // No `row`: this is refplane.js's own state, in its own localStorage, and
    // it is not a display control of YOUR build — the cut is a clipping
    // plane, the category VIEW_KEEP already exempts for `cutaway` ("it hides
    // geometry from the CAMERA and nothing from the capture"). REFPLANE's
    // cycleCut is the one door, and it does everything the panel's own select
    // does, including zeroing `lat` for the split.
    { k: 'ref', state: 'refplane.cut',
      why: 'the reference aeroplane standing beside your build is not your ' +
           'build: its cut is a clipping plane held in refplane.js own ' +
           'state and saved in its own localStorage, and no capture sees it',
      view: () => {
        const R = window.REFPLANE;
        const standing = !!(R && R.state && R.state.preset !== 'none');
        const cut = (R && R.state && R.state.cut) || 'off';
        // TWO OBJECTS HAVE TO LOOK LIKE TWO. The first cut overlapped them
        // side by side and the overlap drew a line down the middle — which is
        // the SPLIT's own glyph, so `off` and `split` said the same thing. A
        // diagonal offset is the duplicate-glyph everyone already reads.
        const box = (x, y) => '<rect x="' + x + '" y="' + y +
          '" width="8.6" height="7.4" rx="1.5"/>';
        const ICON = {
          // two whole aeroplanes, one standing inside the other
          off: box(2.4, 6.2) + box(7.0, 4.4),
          // yours whole; theirs has lost a half, and the cut edge is straight
          // where every other edge is rounded
          ref: '<path d="M6.7 6.2H3.9a1.5 1.5 0 0 0-1.5 1.5v4.4a1.5 1.5 0 0 ' +
               '0 1.5 1.5h2.8Z"/>' + box(7.0, 4.4),
          // ONE machine, half each: theirs dashed to the left of the
          // centreline they are both cut by, yours solid to the right
          split: '<path d="M9 5.3H5.4A1.5 1.5 0 0 0 3.9 6.8v4.4a1.5 1.5 0 0 ' +
                 '0 1.5 1.5H9" stroke-dasharray="2.2 1.8"/>' +
                 '<path d="M9 5.3h3.6a1.5 1.5 0 0 1 1.5 1.5v4.4a1.5 1.5 0 0 ' +
                 '1-1.5 1.5H9"/><path d="M9 3.9v10.2"/>',
        };
        const SAYS = { off: 'both aeroplanes whole, one inside the other',
                       ref: 'the reference halved, your build whole',
                       split: 'split — your right half, their left half' };
        return { on: standing && cut !== 'off', off: !standing,
          title: standing
            ? 'Against the reference: ' + SAYS[cut] + ' — click for the next'
            : 'No reference standing — pick one on the reference plane',
          icon: ICON[cut] || ICON.off };
      },
      act: () => {
        const R = window.REFPLANE;
        if (R && R.cycleCut) R.cycleCut();
      } },
    // ---- the light --------------------------------------------------------
    { k: 'time', row: 'time of day',
      view: () => {
        const GE = window.GARAGE_ENV;
        const list = (GE && GE.moods && GE.moods()) || [];
        const name = String(list[(GE && GE.mood && GE.mood()) | 0] || '')
          .toUpperCase();
        // ONE GLYPH PER DECLARED MOOD, by the mood's own name (hangar_sky.js
        // SKY_ROWS). A name with no glyph falls back to the high sun rather
        // than to nothing: a sky added later must not blank the button.
        const sun = (cy, r) => '<circle cx="9" cy="' + cy + '" r="' + r + '"/>';
        const rays = cy => '<path d="M9 ' + (cy - 4.6) + 'v-1.3M4.4 ' + cy +
          'h-1.3M13.6 ' + cy + 'h1.3M5.6 ' + (cy - 3.3) +
          'l-.9-.9M12.4 ' + (cy - 3.3) + 'l.9-.9"/>';
        const horizon = y => '<path d="M2.4 ' + y + 'h13.2"/>';
        const ICON = {
          AFTERNOON: sun(8.2, 3.1) + rays(8.2),
          GOLDEN: sun(8.6, 2.7) + rays(8.6) + horizon(13.4),
          // half a sun, ON the line
          SUNSET: '<path d="M6.1 12.6a2.9 2.9 0 0 1 5.8 0"/>' + horizon(12.6) +
                  '<path d="M9 6.6V5.3M4.6 8.4l-.9-.9M13.4 8.4l.9-.9"/>',
          // it has gone under the line, and the first star is out
          DUSK: '<path d="M6.1 12.6a2.9 2.9 0 0 0 5.8 0" ' +
                'stroke-dasharray="2 1.7"/>' + horizon(12.6) +
                '<path d="M12.9 5.1v2.2M11.8 6.2h2.2"/>',
          NIGHT: '<path d="M14.2 11.1A5.8 5.8 0 0 1 6.9 3.8a5.8 5.8 0 1 0 ' +
                 '7.3 7.3Z"/>',
          OVERCAST: '<path d="M5.9 12.9h6.4a2.6 2.6 0 0 0 .4-5.1 3.6 3.6 0 0 ' +
                    '0-6.9-.7 2.9 2.9 0 0 0 .1 5.8Z"/>',
        };
        return { on: false, off: !list.length,
          title: list.length
            ? 'The light: ' + name.toLowerCase() + ' — click for the next sky'
            : 'No room to light — the shed is not in this build',
          icon: ICON[name] || ICON.AFTERNOON };
      },
      // THROUGH THE SELECT, so _cage_ui's own handler moves the mood and the
      // rail's night label hears the change it is already listening for.
      act: () => {
        const r = labelIndex().get('time of day');
        const sel = r && r.querySelector('select');
        const GE = window.GARAGE_ENV;
        if (sel && sel.options.length) {
          sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
          sel.dispatchEvent(new Event('change'));
        } else if (GE && GE.setMood && GE.moods) {
          const n = (GE.moods() || []).length;
          if (n) GE.setMood(((GE.mood() | 0) + 1) % n);
        }
      } },
  ];

  function buildQuick() {
    const bar = $('edQuick');
    if (!bar || bar.children.length) return;
    for (const q of QUICK) {
      const b = document.createElement('button');
      b.className = 'edQuickBtn';
      b.type = 'button';
      b.dataset.q = q.k;
      b.onclick = () => { if (!b.disabled) { q.act(); syncQuick(); } };
      bar.appendChild(b);
    }
    // the reference panel says when its aeroplane changes — without it the
    // button would stay greyed until something else repainted the bar
    window.REF_ON_CHANGE = syncQuick;
    hookXray();
    syncQuick();
  }

  // ...and the flyout's own checkbox is the other way this state moves. Same
  // shape as hookMoodSelect: listen, never re-handle.
  let xrayHooked = false;
  function hookXray() {
    if (xrayHooked) return;
    const c = $('xray');
    if (c) { c.addEventListener('change', syncQuick); xrayHooked = true; }
  }

  // THE BUTTONS ARE REPAINTED, NEVER RE-WIRED. There are three: rewriting the
  // glyph costs less than reasoning about which part of it changed, and the
  // handler is bound once, in buildQuick.
  function syncQuick() {
    const bar = $('edQuick');
    if (!bar) return;
    hookXray();
    for (const b of bar.children) {
      const q = QUICK.filter(x => x.k === b.dataset.q)[0];
      if (!q) continue;
      const st = q.view();
      b.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true">' +
        st.icon + '</svg>';
      b.title = st.title;
      b.setAttribute('aria-label', st.title);
      b.disabled = !!st.off;
      b.classList.toggle('on', !!st.on && !st.off);
    }
  }

  // the label -> row index, over everywhere a row _cage_ui built can be
  // sitting: the overflow section, the parking nursery, and the shed sheet
  // (the room's panel moves there whole, and the `night` flyout borrows two of
  // its rows back)
  function labelIndex() {
    const idx = new Map();
    // WHEREVER THE ROW IS. The nursery holds a root's rows while it is not
    // selected — but while it IS, they are in the properties column, and a
    // flyout that could not borrow from there showed an empty `night` panel
    // for exactly the object whose light it is about. `render` returns
    // borrowed rows before it re-parks the column and re-opens the flyout
    // afterwards, so nothing is ever stranded in two places.
    for (const host of [$('cgUi'), nursery, rowsEl]) {
      if (!host) continue;
      for (const r of host.querySelectorAll('.r')) {
        // THE AEROPLANE'S ROWS ARE NEVER CLAIMED BY LABEL (G136). A part-table
        // parameter row is already claimed by KEY; letting it answer a label
        // query is how the shed's `lights` switchboard and the aeroplane's
        // `lights` master — one label, two objects — traded places, with
        // whichever sat first in document order winning. (`canopy loops` was
        // the same double.) `explodeD` and friends stay findable: they carry a
        // key the part table does not own.
        if (r.dataset.k && PT.paramOwner[r.dataset.k]) continue;
        const k = r.querySelector('span.k');
        if (k && !idx.has(k.textContent)) idx.set(k.textContent, r);
      }
    }
    return idx;
  }

  // A FLYOUT BORROWS, IT DOES NOT TAKE. Every row it shows is put back exactly
  // where it was — which matters because the `night` flyout's two rows belong
  // to the shed sheet's own panel, and parking them in the nursery instead
  // would quietly empty the sheet the first time anyone looked at the light.
  const borrowed = [];
  function returnRows() {
    while (borrowed.length) {
      const b = borrowed.pop();
      if (b.parent) b.parent.insertBefore(b.row, b.next);
    }
  }
  function borrow(row, body) {
    borrowed.push({ row, parent: row.parentElement, next: row.nextSibling });
    body.appendChild(row);
  }

  // THE FLYOUT SURVIVES A SELECTION. `render` returned its rows before it
  // re-parked the column, so the body is empty and its contents are back
  // where they belong; this fills it again from wherever they are NOW. It is
  // a re-open and not a repaint because openFly is already the one place that
  // knows how a flyout is assembled.
  function reopenFly() { if (flyOpen) openFly(flyOpen); }

  function openFly(k) {
    const fly = $('edFly'), body = $('edFlyBody'), head = $('edFlyHead');
    if (!fly) return;
    returnRows();
    for (const r of Array.from(body.children)) r.remove();
    flyOpen = k;
    for (const b of $('edRail').children)
      b.classList.toggle('on', b.dataset.f === k);
    if (!k) { fly.hidden = true; return; }
    const t = RAIL.filter(x => x.k === k)[0];
    fly.hidden = false;
    // BESIDE ITS OWN BUTTON (2026-09-03). An answer that always appears in
    // the same place does not say which question it answers, so it is
    // measured rather than computed from the button index — the icons are not
    // all the same width and a later one will not be. With the ribbon
    // standing up the left edge it opens to the RIGHT of the rail, top-
    // aligned to its button and pulled up only as far as the estate makes it;
    // that is #flFly's own rule, and the two screens are the same screen for
    // this purpose. Clamped to the free estate — #edView is already inset by
    // both panels, so its own box is the whole of what is available.
    {
      const btn = [...$('edRail').children].filter(b => b.dataset.f === k)[0];
      const view = $('edView'), rail = $('edRail');
      if (btn && view) {
        const vb = view.getBoundingClientRect(), bb = btn.getBoundingClientRect();
        const rb = (rail || btn).getBoundingClientRect();
        // IT NEVER COVERS THE RIBBON IT ANSWERS. The flight screen can leave
        // the width at 296 because its estate is the whole window; this one
        // is inset by BOTH panels and is routinely 320 px wide, and a flyout
        // that swallows the buttons hides the question with the answer. So
        // the width gives way first, down to a floor, and only then the gap.
        const strip = rb.right - vb.left + 10;
        const w = Math.min(296, Math.max(196, vb.width - strip - 22));
        fly.style.width = Math.round(w) + 'px';
        fly.style.left = Math.round(Math.max(22,
          Math.min(strip, vb.width - w - 22))) + 'px';
        // anchored by `top`, so it grows DOWN from the button it belongs to;
        // maxHeight first, because the height it settles at is what the
        // clamp below has to read
        fly.style.bottom = 'auto';
        const maxH = Math.max(120, vb.height - 44);
        fly.style.maxHeight = Math.round(maxH) + 'px';
        const hFly = Math.min(fly.offsetHeight || 260, maxH);
        fly.style.top = Math.round(Math.max(22,
          Math.min(bb.top - vb.top - 8, vb.height - hFly - 22))) + 'px';
      }
    }
    head.textContent = t.title;
    if (t.k === 'camera') buildCamera(body);
    if (t.k === 'controls') buildControls(body);
    if (t.k === 'graphics') buildGraphics(body);   // GFX
    if (t.k === 'legend') buildLegend(body);
    const idx = labelIndex();
    for (const label of (t.rows || [])) {
      const r = idx.get(label);
      if (r) borrow(r, body);
    }
    if (t.k === 'measure') {
      const m = $('dims');
      if (m) borrow(m, body);
    }
    // THE MESH COUNTS ARE GONE FROM THE SCREEN (the user: "you can fully drop
    // the blob of text under display"). G86 moved them off the panel and
    // behind this flyout; that was half the move, because a diagnostic nobody
    // asked for is noise wherever it is drawn. #edStat stays in the nursery
    // and _cage_ui.js keeps writing to it — the measurement is still taken,
    // it is simply not on the screen. Nothing else reads it, so removing the
    // borrow is the whole change.
    // THE `tune the shed ›` PILL IS GONE with the sheet it opened (G108). The
    // shed is a tree root; a flyout that is about LOOKING has no business
    // being a second door to an object you can select.
  }

  // THE FRAMING PRESETS. The game's own orbit camera, driven through the
  // bridge — the bench's `setView` moves a camera the game does not use.
  // G200: WHO FLIES IT, AND WITH WHAT — the same panel the flight screen
  // opens, reached from the shed (the user's ruling: both environments).
  // The rows READ window.FLYDIY_INPUT; the panel IS window.INPUT_PANEL;
  // this file holds none of it. On the stand a hand on a bound control moves
  // the surfaces (app.js's control-check sweep yields to it), so a mapping
  // can be checked without rolling out.
  // G286: GRAPHICS - gfx_settings.js's menu in this rail's own rows and
  // pills; a pick rebuilds the flyout so the pills show the new state (GFX)
  function buildGraphics(body) {
    if (!window.GFX) return;
    const row = (host, label) => {
      const r = document.createElement('div'); r.className = 'r';
      const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
      r.appendChild(k); host.appendChild(r); return r;
    };
    const pills = (host, list, isOn, pick) => {
      const w = document.createElement('div'); w.className = 'edCam';
      for (const o of list) {
        const b = document.createElement('button');
        b.className = 'pill' + (isOn(o) ? ' on' : '');
        b.textContent = o.label; if (o.title) b.title = o.title;
        if (o.why) b.disabled = true; else b.onclick = () => pick(o);
        w.appendChild(b);
      }
      host.appendChild(w); return w;
    };
    const note = (host, txt) => {
      const n = document.createElement('div'); n.className = 'note'; n.textContent = txt;
      host.appendChild(n); return n;
    };
    window.GFX.mount(body, { row, pills, note, refresh: () => openFly('graphics') });
  }
  function buildControls(body) {
    const inp = (typeof window !== 'undefined' && window.FLYDIY_INPUT) || null;
    const row = (label, txt) => {
      const r = document.createElement('div'); r.className = 'r';
      const k = document.createElement('span'); k.className = 'k'; k.textContent = label;
      const v = document.createElement('span'); v.className = 'v';
      v.style.width = 'auto'; v.style.textAlign = 'left'; v.textContent = txt;
      r.appendChild(k); r.appendChild(v); body.appendChild(r);
      return r;
    };
    if (!inp) { row('controls', 'not in this build'); return; }
    for (const d of inp.devices())
      row(d.kind === 'keyboard' ? 'keyboard' : 'controller',
          d.kind === 'keyboard' ? 'always' : d.label);
    const w = document.createElement('div');
    w.className = 'edCam';
    const b = document.createElement('button');
    b.className = 'pill';
    b.textContent = 'map the controls…';
    b.title = 'Bind the keyboard, a stick and a throttle — the same panel the ' +
              'flight screen opens. Move a bound control and the aeroplane on ' +
              'the stand answers it.';
    b.onclick = () => {
      if (window.INPUT_PANEL)
        window.INPUT_PANEL.open(inp, { who: () => 'in the shed — the stand answers the hand' });
    };
    w.appendChild(b);
    body.appendChild(w);
    row('a controller', 'press a button on it first');
  }

  function buildCamera(body) {
    const wrap2 = document.createElement('div');
    wrap2.className = 'edCam';
    for (const [label, key] of [['3/4 front', 'q'], ['side', 's'],
                                ['plan', 't'], ['nose', 'f'],
                                ['interior', 'i'], ['refit', 'r']]) {
      const b = document.createElement('button');
      b.className = 'pill';
      b.textContent = label;
      // INTERIOR IS THE PILOT'S OWN EYE POINT (G107), not the 4.4 m orbit
      // that used to be called `cockpit` — app.js's own comment said that one
      // was an approximation and named what a real one would need: "the crew
      // layer's own marker and a camera that is not an orbit". The marker is
      // published now (window.CAGE_CREW_EYE) and the orbit pivots about a
      // point in front of the eyes, with the polar, radius and room clamps
      // off and the pilot's head hidden.
      //
      // NO PILOT, NO VIEW. The crew layer is a switch on the aeroplane, so
      // the button says why it cannot rather than framing nothing — asking
      // the same published object app.js asks.
      if (key === 'i' && !window.CAGE_CREW_EYE) {
        b.disabled = true;
        b.title = 'No pilot in this build — turn the crew layer on ' +
                  '(Cabin fit → fitted)';
      } else if (key === 'i') {
        b.title = 'Look out of the pilot’s eyes. Drag to look around.';
      }
      b.onclick = () => { if (api.camera) api.camera(key); };
      wrap2.appendChild(b);
    }
    body.appendChild(wrap2);
    // G255: SCREENSHOT MODE — every panel, rail and mark off the screen, the
    // render alone; one transparent way back (top right) and the Esc key.
    // app.js owns the switch (window.SHOT_MODE) because both screens use it.
    if (window.SHOT_MODE) {
      const w3 = document.createElement('div');
      w3.className = 'edCam';
      const b = document.createElement('button');
      b.className = 'pill';
      b.textContent = 'screenshot';
      b.title = 'Hide every panel and mark — the render alone. Esc, or the ' +
                'faint button top right, brings the interface back.';
      b.onclick = () => { openFly(null); window.SHOT_MODE.enter(); };
      w3.appendChild(b);
      body.appendChild(w3);
    }
  }

  // G255: THE LEGEND. The two posts the room draws are the one instrument
  // the user reads for balance ("when I talk about CG, I talk mostly about
  // the editor representation, the vertical line"), and their labels were
  // initials. Plain words, on demand; the numbers stay on the posts.
  function buildLegend(body) {
    const item = (swatch, head, txt) => {
      const r = document.createElement('div'); r.className = 'edLegend';
      const s = document.createElement('i'); s.className = 'sw ' + swatch;
      const k = document.createElement('b'); k.textContent = head;
      const v = document.createElement('span'); v.textContent = txt;
      r.appendChild(s); r.appendChild(k); r.appendChild(v); body.appendChild(r);
    };
    item('amber', 'centre of gravity (CG) — the amber post',
         'where the aeroplane balances. Quoted as a percentage of the wing ' +
         'chord, measured back from the leading edge (“% MAC”: per ' +
         'cent of the mean aerodynamic chord, the wing’s average chord). ' +
         'It moves live: the engine fore-aft, the boom, the tanks, the seats.');
    item('cyan', 'neutral point (NP) — the cyan post',
         'the point the CG must stay AHEAD of. Behind it the nose runs away ' +
         'in pitch and no pilot can hold it. It moves with the wing and the ' +
         'tail, not with the weights.');
    item('bar', 'stability margin (SM) — the bar between them',
         'the gap, as a percentage of the chord. Comfortable: 10 to 25 %. ' +
         'Under 5 % is twitchy (the post turns red); negative is unflyable.');
    item('none', 'where it should sit',
         'for most aeroplanes 25 to 35 % of the chord, well ahead of the ' +
         'neutral point. Too far forward and the elevator cannot lift the ' +
         'nose to land; too far back and it will not settle. Move the wing ' +
         'aft to gain margin, forward to lose it; move weight the other way.');
    item('pale', 'the pale crosses',
         'where each wheel touches the ground.');
  }

  // ---- the loan ------------------------------------------------------------
  // THERE ARE NO SHEETS LEFT. The aeroplane's went at G91 (the plaque became
  // the permanent information panel, because a plaque you have to open hides
  // the consequence of the slider you just moved) and the shed's goes here
  // (it is a tree root). UI-MODEL section 2.4 reserves exactly one for the
  // FLEET RACK — browsing forty aeroplanes wants width — and that chantier
  // brings its own scrim back with it rather than inheriting a dead one.
  //
  // THE LOAN ITSELF IS GONE (G135). WHICH AEROPLANE IS ON THE STAND used to be
  // a question, so the game's own `#selAc` was MOVED here rather than copied.
  // It is not a question any more: the seven hand fiches are gate subjects and
  // the select holds one hidden option, so what the panel borrowed was an empty
  // box. `#edStand`/`#shAc` went with it. What replaces it is the FLEET RACK —
  // YOUR builds — and until then the ribbon's `#fbName` names the one on the
  // stand. releaseView keeps its name and its export: it still closes whatever
  // is floating over a view that is about to become the world.
  function releaseView() {
    openFly(null);
  }

  // =========================================================================
  // SELECTION IS BIDIRECTIONAL (G79)
  // =========================================================================
  // ROADMAP P8 §4: "viewport clicks select parts (raycast on material
  // groups)". app.js throws the ray and reports a HIT — which mesh section was
  // struck, which named object, which layer — and this turns it into a part.
  // The split is deliberate: app.js owns the scene graph and the camera and
  // never learns the assembly; this file owns the assembly and never learns
  // the scene graph.
  //
  // A SECTION RESOLVES THROUGH THE PART TABLE, which already says which part
  // owns which mesh material (G76). A LAYER OBJECT resolves through its NAME
  // where the layers bothered to give it one, and otherwise falls back to the
  // first part in the table declaring that layer — so a layer added later
  // lands somewhere sensible with no edit here. (GEN_ACCESS's `cageLayer:
  // access` will resolve the moment its part row exists.)
  //
  // The name table is HERE and not in the part table on purpose: it is not
  // part of what an aeroplane IS, it is how this one naming convention —
  // edWheelL, edProp, edSurf_ailR, edFit_pitot, grown ad hoc across six layer
  // files — is read. When that convention is regularised the entries move.
  const HIT_NAME = [
    // THE WHEEL KIT IS ITS OWN PART AND WAS UNREACHABLE. Every gear mesh
    // resolved to a STATION, so `hiBuild` built keys={'wheels'} while every
    // mesh's owner came back 'mains' or 'third' — selecting `Wheels & tyres`
    // highlighted NOTHING, on either side of the bridge. The wheels answer to
    // the kit now and the legs to their station, which is also what makes
    // "click a tyre, get the tyre; click a leg, get the leg" true.
    [/^edWheel/, 'wheels'],
    [/^edLegT|^edCastorT/, 'third'],
    [/^edLeg|^edCastor/, 'mains'],
    [/^edSpinner|^edProp/, 'prop'],
    [/^edSurf_(ail|flap)[RL]2$/, 'wingCtl2'],   // G185: the second plane's surfaces
    [/^edLens_wing2|^edBay_wing2/, 'wingPanel2'],
    [/^edFit_cabane/, 'cabane'],           // G185
    [/^edFit_interplane/, 'interplane'],
    [/^edFit_wire/, 'wires'],
    [/^edFit_liftstrut/, 'struts'],
    [/^edFit_pitot/, 'wingPanel'],
    [/^edSurf_ail/, 'wingCtl'],
    // G300: the hardware NAMES ITSELF now — the hinge halves (fixed ones
    // `edHinge_<host>_<bag>`, moving ones attached under their surface), the
    // lamps and the fittings' bags — so a click on a horn selects the Control
    // hardware and not the fin it hangs beside. Before the surface rows below.
    [/^edHinge_|^edLink_/, 'ctlhw'],
    [/^edLamp_|^liRotor_/, 'lights'],
    [/^edAcc_/, 'access'],
    [/^edSurf_rud/, 'fin'],
    [/^edBoom/, 'boom'],                 // the twin booms (G267 their own part; G271 back under Boom)
    [/^edSurf_elev/, 'stab'],
    // the crew layer NAMES ITS FURNITURE now (G113 closed the gap this
    // comment used to declare): seats, control stations and the console
    // carry identity wrappers, the dummies their figure names — and the
    // bones stay as the fallback for anything struck inside a figure.
    [/^edSeat/, 'seats'],
    [/^edCtl|^edConsole/, 'controls'],
    [/^edGauge|^edPanel/, 'instruments'],   // the panel arc: the dials and the switch row
    [/^edDum/, 'crew'],
    [/^(root|lumbar|thorax|neck|head|clavicle|shoulder|elbow|wrist|hip|knee|ankle)/,
     'crew'],
  ];
  const layerDefault = key => {
    for (const p of PT.CAGE_PARTS)
      if (p.layer === key && p.parent && !p.root) return p.key;
    return null;
  };
  //
  // A ZONED SECTION RESOLVES THROUGH THE STATION FIRST (the user: "the
  // fuselage divides into nose ... the pilot cabin ... the passenger bays ...
  // the boom until the flat part at the tail. These parts would need to
  // highlight accordingly"). The covering is one material end to end, so
  // `body` alone would always answer `Fuselage`; app.js hands down which body
  // ZONE was struck and PT.zoneOwner turns that into the part whose bay it
  // is. An unzoned build, or a zone no part claims, falls back to the
  // material's owner exactly as before — the assembly, which is the right
  // answer when the aeroplane has no station there.
  //
  // CAGE_ZONE_PICK and not CAGE_ZONED: the seals are cut to the bay when a
  // BAY is selected, but clicking one still selects `window joints`, because
  // that material DOES answer — it names a part with its own rows.
  //
  // AND IT IS AN OPTION (the user: "Keep this as an option in the menus for
  // now, and we'll see if that's better or worse by using it, but that feels
  // cleaner to me"). `bay` is the default because that is the ruling; `whole`
  // is the behaviour before the station table existed, so the two can be
  // compared by using them rather than argued about. It changes what a CLICK
  // means and nothing else — a selection of a bay is still cut to that bay in
  // either position, because that is what makes the tree row mean anything.
  const LS_PICK = 'flydiy.edPickBay';
  let pickBay = pref(LS_PICK) !== 'whole';
  // A PART CAN HOLD A LIST, and then a click has to say WHICH ONE (2026-09-05).
  // The energy layer draws one solid per vessel and names it `edVessel_<i>_…`
  // (`edFuel_<i>` for what is in it), so the index is in the mesh name and the
  // layer is the only thing that knows what to do with it. Returns true when
  // the hit named an entry, so the caller knows the click MOVED within a part
  // and must not read as a second click on the same one.
  function instanceOfHit(hit) {
    const n = hit && hit.name;
    if (!n) return false;
    const m = /^ed(?:Vessel|Fuel)_(\d+)/.exec(n);
    if (!m || !window.CAGE_ENERGY || !window.CAGE_ENERGY.select) return false;
    return window.CAGE_ENERGY.select(+m[1]);
  }
  function partOfHit(hit) {
    if (!hit) return null;
    if (pickBay && hit.section &&
        PT.CAGE_ZONE_PICK && PT.CAGE_ZONE_PICK.has(hit.section)) {
      const z = hit.zone && PT.zoneOwner[hit.zone];
      if (z && PT.partByKey[z] && exists(PT.partByKey[z])) return z;
    }
    if (hit.section) return PT.sectionOwner[hit.section] || 'fuselage';
    for (const [re, key] of HIT_NAME)
      if (hit.name && re.test(hit.name) && PT.partByKey[key]) return key;
    return layerDefault(hit.layer);
  }

  // ---- the highlight ------------------------------------------------------
  // AN OVERLAY, NOT A MATERIAL. Tinting by mutating the part's own material
  // would fight the AEROSKIN factory for ownership of it — and that factory is
  // another session's live work. So the highlight is its own translucent
  // geometry drawn over the part: it shares the cage's position buffer and
  // draws a subset of its indices, and for a layer part it re-draws that
  // object's own geometry as a child of it, which inherits its transform for
  // free. Nothing the aeroplane is made of is touched.
  //
  // `edHi` marks it in two directions: app.js's ray steps over it, and
  // _cage_ui's uniform-material pass leaves it alone (`cageUni` is that pass's
  // own "already final" flag, and this material is).
  // ---- THE STYLE IS AN OPTION (G95, user: "Can the highlighting rather
  // highlight the outline of the part, in a noticeable color? Maybe keep that
  // as an option again, and at some point I'll decide the default value of all
  // of these") ---------------------------------------------------------------
  // A TRANSLUCENT FILL SAYS "SOMEWHERE IN HERE"; AN OUTLINE SAYS "THIS". On an
  // aeroplane whose parts are mostly pale and mostly touching, a 34 % wash over
  // one of them is hard to find and impossible to trace the edge of — which is
  // the thing you actually want to see when you are choosing between a fairing
  // and the panel behind it.
  //
  // AND THERE ARE TWO KINDS OF "THIS" (G131, the user: "The current outline is
  // very sexy, but a little disturbing. I had in mind a global silhouette
  // outline of the full part, not the detail within them"). `outline` is the
  // part DRAWN — every crease EdgesGeometry keeps — and `silhouette` is the
  // part's one closed contour against everything else, which no edge table can
  // give because it depends on where the camera stands. See hiSilShell below
  // for how it is actually made.
  //
  // THE DEFAULT IS DECIDED — by the user, and only after seeing all three
  // side by side (G131 shipped with `outline` still holding the chair while
  // they said "I can't make up my mind"; G131.1, next day: "silhouette
  // should be the default"). It is stated in one place, persisted, offered
  // as the `selection` row of the display flyout, and reachable at runtime
  // as `window.EDITOR_HILITE` so it can be flipped without a rebuild. A
  // saved pref still wins over this default, as any menu choice should.
  //
  // r128 FACT, so nobody spends an afternoon on it: `LineBasicMaterial.
  // linewidth` is IGNORED by every desktop WebGL driver — the core profile
  // only guarantees 1 px. A thicker outline needs fat-line geometry (two
  // triangles per segment), which is a different chantier; `width` below is
  // recorded as intent and does nothing yet. The silhouette does NOT have this
  // problem — its shell is triangles already — which is why `silW` works.
  const HI_DEF = {
    mode: 'silhouette',     // 'outline' | 'silhouette' | 'fill' | 'both'
    line: 0x00e5ff,         // the selection outline: nothing on the aeroplane
    lineHov: 0x66f0ff,      // or in the shed is this colour, which is the point
    fill: 0xe6dbc9,         // what the wash was, kept for 'fill' and 'both'
    through: true,          // draw over the aeroplane, so a part behind the
                            // covering can still be seen to be selected
    angle: 24,              // EdgesGeometry threshold, degrees
    width: 1,               // intent only — see the r128 note above
    silW: 0.015,            // silhouette rim, metres of view space — constant
                            // in the world, so it thins as you step back...
    pin: 0xffb03a,          // THE HOVER PIN: the corner a row moves. Amber, not
                            // the selection's cyan — it answers a different
                            // question ("which point is this?") and the two are
                            // on screen together while you hover a row of the
                            // part you have selected.
    pinPx: 6,               // its diameter, in output pixels (see hiPxFeed)
    silPx: 2,               // ...but never under this many OUTPUT pixels. At a
                            // normal garage distance 1.5 cm is ~1 px, and a
                            // 1-px line does not survive the G144 resolve pass
                            // (measured 2026-09-03: 1947 rim px in the target,
                            // 46 after the 1.25x resample). See hiSilShell.
  };
  const HI_PREF = 'flydiy.edHilite';
  const HI = Object.assign({}, HI_DEF);
  try { Object.assign(HI, JSON.parse(localStorage.getItem(HI_PREF) || '{}')); }
  catch (e) {}
  let hiSel = null, hiHov = null, hiMats = null;
  function hiMat(op) {
    const m = new THREE.MeshBasicMaterial({
      color: HI.fill, transparent: true, opacity: op, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.userData.cageUni = 1;
    return m;
  }
  function hiLine(which) {
    const m = new THREE.LineBasicMaterial({
      color: which === 'sel' ? HI.line : HI.lineHov,
      transparent: true, opacity: which === 'sel' ? 1 : 0.75,
      depthTest: !HI.through, depthWrite: false, linewidth: HI.width });
    m.userData.cageUni = 1;
    return m;
  }
  // ---- THE SILHOUETTE (G131) ----------------------------------------------
  // A silhouette is VIEW-DEPENDENT, so it cannot come from an edge table; it
  // is made in the stencil buffer instead, in two passes per highlight:
  //
  //   the MASK draws every highlighted mesh invisibly (colorWrite off, depth
  //   ignored) and stamps the part's screen footprint into one stencil bit;
  //   the SHELL draws the same meshes again, inflated along the view-space
  //   normal by `silW`, and is only allowed to land where its own bit is NOT
  //   set. What survives is the rim between the inflated shape and the real
  //   one — the union contour of ALL the part's meshes, because every mesh
  //   masks every other mesh's shell.
  //
  // Selection owns bit 1 and hover bit 2, so the two silhouettes coexist
  // without erasing each other. The renderer asks for a stencil clear every
  // frame (autoClear) — and it only GETS one if the GL stencil write mask is
  // open when the clear runs, which is the shell's job below; see THE CLEAR
  // IS MASKED TOO in hiSilShell for the bug this sentence used to hide.
  //
  // The inflation is MeshBasicMaterial + onBeforeCompile rather than a raw
  // ShaderMaterial for one reason: the renderer runs a logarithmic depth
  // buffer, and the built-in material carries the logdepthbuf chunks that a
  // hand-rolled shader would have to re-import to depth-test correctly when
  // `through` is off. Offsetting in VIEW space (normalMatrix included) makes
  // `silW` world-metres whatever the mesh's own unit is — the cage draws in
  // mesh units under a scale, the layers in metres, and one rim fits both.
  //
  // KNOWN AND ACCEPTED: a cube probe render target has no stencil buffer, so
  // inside `craftInProbe` (off by default, app.js:413 hides the craft from
  // the bake) a live highlight would bake unmasked. The fill and the edge
  // outline bake into that probe too — the cure for all three is the same:
  // deselect, rebake.
  function hiSilMask(which) {
    const bit = which === 'sel' ? 1 : 2;
    const m = new THREE.MeshBasicMaterial({
      colorWrite: false, depthWrite: false, depthTest: false,
      side: THREE.DoubleSide });
    m.stencilWrite = true;
    m.stencilRef = bit;
    m.stencilWriteMask = bit;
    m.stencilZPass = THREE.ReplaceStencilOp;
    m.userData.cageUni = 1;
    return m;
  }
  function hiSilShell(which) {
    const bit = which === 'sel' ? 1 : 2;
    const m = new THREE.MeshBasicMaterial({
      color: which === 'sel' ? HI.line : HI.lineHov,
      transparent: true, opacity: which === 'sel' ? 1 : 0.75,
      depthTest: !HI.through, depthWrite: false, fog: false,
      side: THREE.DoubleSide });
    // THE SHELL TESTS AND NEVER STAMPS — but not by closing the write mask.
    // The first build set stencilWriteMask = 0 for that, and it worked on a
    // still camera and failed on a moving one: glClear honours glStencilMask,
    // r128 never resets the mask between frames (its end-of-render reset
    // covers depth and colour only), and the shell is the last stencil
    // material of every frame — so from the second frame on autoClear's
    // stencil clear cleared NOTHING, every footprint the mask had ever stamped
    // stayed set, and the rim was eaten on the trailing side of any orbit
    // (measured 2026-09-03: 2392 rim px still, 940 after an orbit and back,
    // 2392 again with the mask open). The ops are all Keep, which is what
    // "never stamps" actually means; the mask stays fully open so the next
    // frame's clear can do its work.
    m.stencilWrite = true;
    m.stencilWriteMask = 0xff;
    m.stencilFail = THREE.KeepStencilOp;
    m.stencilZFail = THREE.KeepStencilOp;
    m.stencilZPass = THREE.KeepStencilOp;
    m.stencilFunc = THREE.NotEqualStencilFunc;
    m.stencilRef = bit;
    m.stencilFuncMask = bit;
    // THE RIM HAS A FLOOR IN PIXELS. `silW` is world metres (constant on the
    // aeroplane, thinning as you step back), and at garage distances it is a
    // one-pixel line — which the G144 resolve pass then resamples into a faint
    // two-pixel smear (Catmull-Rom over a 1.25x target: 1947 rim px in the
    // target, 46 after the resample). So the offset is the LARGER of silW and
    // `silPx` output pixels, the pixel's world size read off the projection
    // itself (P[1][1] = 1/tan(fov/2); [3][3] tells perspective from ortho)
    // and the drawing-buffer height fed in by hiSilFeed — the OUTPUT height,
    // so under a supersampled target the rim is silPx*ss source pixels and
    // lands as silPx pixels on screen.
    m.onBeforeCompile = sh => {
      sh.uniforms.hiSilW = { value: HI.silW };
      sh.uniforms.hiSilPx = { value: HI.silPx };
      sh.uniforms.hiSilVH = { value: 1000 };
      sh.vertexShader = ('uniform float hiSilW;\nuniform float hiSilPx;\n' +
        'uniform float hiSilVH;\n' + sh.vertexShader).replace(
        '#include <project_vertex>',
        ['vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );',
         'float hiDepth = projectionMatrix[3][3] > 0.5 ? 1.0 : -mvPosition.z;',
         'float hiPxWorld = 2.0 * hiDepth / ( projectionMatrix[1][1] * hiSilVH );',
         'float hiOff = max( hiSilW, hiSilPx * hiPxWorld );',
         'mvPosition.xyz += normalize( normalMatrix * normal ) * hiOff;',
         'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
      m.userData.sh = sh;              // hiSilFeed writes hiSilVH through this
    };
    m.userData.cageUni = 1;
    return m;
  }
  // the one per-frame fact a pixel-sized overlay cannot read off its own
  // matrices: how tall the OUTPUT is, in pixels. onBeforeRender hands over the
  // renderer, and getDrawingBufferSize is the canvas whatever target is bound
  // — which is the height both the silhouette rim and the pin are measured
  // against. One feeder, two uniforms: whichever the material declares.
  let hiSilV2 = null;
  function hiPxFeed(renderer, scene, camera, geometry, material) {
    const sh = material && material.userData && material.userData.sh;
    if (!sh || !renderer.getDrawingBufferSize) return;
    hiSilV2 = hiSilV2 || new THREE.Vector2();
    renderer.getDrawingBufferSize(hiSilV2);
    const h = hiSilV2.y || 1;
    if (sh.uniforms.hiSilVH) sh.uniforms.hiSilVH.value = h;
    if (sh.uniforms.hiPinVH) sh.uniforms.hiPinVH.value = h;
  }
  // one mask + one shell over the same geometry, in stamp-then-test order.
  // The mask is opaque-list (colorWrite off keeps it invisible) and the shell
  // transparent-list, so the renderer itself guarantees the order.
  function hiSilPair(geo, which, addTo, scaleOf) {
    const pair = [
      new THREE.Mesh(geo, hiMats[which === 'sel' ? 'selM' : 'hovM']),
      new THREE.Mesh(geo, hiMats[which === 'sel' ? 'selS' : 'hovS'])];
    pair[0].renderOrder = 6; pair[1].renderOrder = 7;
    pair[1].onBeforeRender = hiPxFeed;
    for (const m of pair) {
      if (scaleOf) m.scale.copy(scaleOf);
      m.userData.edHi = 1;
      addTo.add(m);
    }
    return pair;
  }

  // ONE OUTLINE, from whatever geometry it is handed. EdgesGeometry keeps only
  // the edges where two faces meet at more than `angle`, which is what turns a
  // shaded solid into the drawing of it — a wireframe would give every triangle
  // and read as noise.
  function hiEdges(geo, which) {
    const e = new THREE.EdgesGeometry(geo, HI.angle);
    const l = new THREE.LineSegments(e, hiMats[which === 'sel' ? 'selL' : 'hovL']);
    l.renderOrder = 7;
    l.userData.edHi = 1;
    l.userData.edOwnGeo = 1;
    return l;
  }
  // =========================================================================
  // THE PIN — WHICH CORNER DOES THIS ROW MOVE? (2026-09-03, the user: "would
  // you be able to do some highlighting of the corresponding corner/vertex
  // when hovering for the fin and stabs? And maybe for the cowl?")
  // =========================================================================
  // The tail is drawn from NAMED POINTS — the tip, the shoulder, the top-aft
  // and base corners, the mid and u rows, the guard strands — and eleven of
  // the fin's rows are two-axis offsets on one of them. Reading "top-aft
  // up / down" tells you what the number does and not which corner it is; a
  // dot on the corner does, and it is the same answer the trunk's re-ordering
  // was reaching for one level up.
  //
  // THE POINT COMES FROM THE BUILD, NEVER RE-DERIVED. `buildFin2` publishes its
  // name -> index map (2026-09-03) and this reads the vertex out of the cage
  // the editor has just built, so the dot sits on the drawn corner through
  // every clamp, every rebase and the live deck — and it MOVES as you drag,
  // because applyVis rebuilds it at the end of every build. A second
  // implementation of "where is the tip" would be a second answer.
  //
  // Three layers, three ways in, all of them the layer's own published data:
  //   fin    a named vertex of CAGE_FIN.cage, in the layer's own space
  //   stab   the same names, laid flat by FIN_GEN.finToStab with the opts the
  //          stab build published — and both sides, because an elevator
  //          corner exists twice
  //   cowl   COWL_GEN is a live singleton over the live parameters, so the
  //          points are asked of the same functions that drew the surface:
  //          a station ring for the ends and the seam, a surface point for
  //          the scoop, the oil door, the parting line and the bulges
  //
  // A NAME THAT IS NOT THERE IS SKIPPED, not defaulted: the guard pair, the
  // keel tab and the dorsal each take vertices out of the mesh entirely, and
  // a pin on a vertex that does not exist is a pin in the wrong place.
  const PIN_TAIL = {
    tip: ['tip'], shoulder: ['shoulder'], aft: ['topTE'],
    base: ['kTE', 'loTE', 'hiTE'],
    mid: ['midH1', 'midH2', 'midTE'], u: ['uH1', 'uH2', 'uTE'],
    top: ['topH1', 'topH2'], le: ['leC'],
    root: ['loC', 'hiC', 'leC'],
    rootLine: ['loC', 'loH1', 'loH2', 'loTE'],
    guard: ['hiC', 'hiH1', 'hiH2', 'hiTE'],
    hinge: ['topH1', 'topH2', 'loH1', 'loH2'],
    keel: ['kH1', 'kH2', 'kTE'],
    dorsal: ['leA', 'loA', 'leB', 'loB'],
    crA: ['leB', 'hiB', 'loB'], crB: ['leC', 'hiC', 'loC'],
    teRoot: ['loTE', 'hiTE'], teU: ['uTE'], teMid: ['midTE'],
  };
  // fin key -> tail point set. The stab's are the same table under st*, which
  // is the point of the stab being the fin model laid flat.
  const PIN_ROW = {};
  {
    const F = {
      TipZ: 'tip', TipY: 'tip', SharpTip: 'tip',
      ShoulderZ: 'shoulder', ShoulderY: 'shoulder', SharpShoulder: 'shoulder',
      AftZ: 'aft', AftY: 'aft', SharpAft: 'aft',
      BaseZ: 'base', BaseY: 'base', SharpBase: 'base',
      MidY: 'mid', UY: 'u', TopY: 'top',
      RootFwd: 'root', LEZ: 'le', LEY: 'le', SharpLE: 'le',
      TERoot: 'teRoot', TEU: 'teU', TEMid: 'teMid',
      Cut: 'hinge', CutGap: 'hinge', RootGuard: 'guard',
    };
    for (const [suf, at] of Object.entries(F)) {
      PIN_ROW['fin' + suf] = { layer: 'fin', at };
      PIN_ROW['st' + suf] = { layer: 'stab', at };
    }
    PIN_ROW.finProject = { layer: 'fin', at: 'rootLine' };
    PIN_ROW.finKeel = { layer: 'fin', at: 'keel' };
    PIN_ROW.finDorsal = { layer: 'fin', at: 'dorsal' };
    PIN_ROW.finCrA = { layer: 'fin', at: 'crA' };
    PIN_ROW.finCrB = { layer: 'fin', at: 'crB' };
    PIN_ROW.stZ = { layer: 'stab', at: 'rootLine' };
    PIN_ROW.stX = { layer: 'stab', at: 'rootLine' };
    PIN_ROW.stY = { layer: 'stab', at: 'rootLine' };
    // THE BOOMS AND THE ROD (G189): rows that move a tube, pinned at the
    // tube's ends. These points are SCENE METRES and their host is the mount
    // itself (`root`): the twin booms are published by the wing layer in
    // scene metres (CAGE_BOOMS), and the rod's span comes off the cage's own
    // resolve in cage units, scaled here.
    const booms = fn => () => {
      const B = window.CAGE_BOOMS;
      return B ? fn(B) : [];
    };
    const boomEnds = booms(B => [[B.x, B.y, B.zRoot], [-B.x, B.y, B.zRoot],
                                 [B.x, B.y, B.zTip], [-B.x, B.y, B.zTip]]);
    PIN_ROW.boomX = { layer: 'root', fn: boomEnds };
    PIN_ROW.boomLen = { layer: 'root',
      fn: booms(B => [[B.x, B.y, B.zTip], [-B.x, B.y, B.zTip]]) };
    // G267: the loft's four sizes, pinned at the end they size
    PIN_ROW.boomWf = { layer: 'root',
      fn: booms(B => [[B.x + B.r0, B.y, B.zRoot], [-B.x - B.r0, B.y, B.zRoot],
                      [B.x - B.r0, B.y, B.zRoot], [-B.x + B.r0, B.y, B.zRoot]]) };
    PIN_ROW.boomHf = { layer: 'root',
      fn: booms(B => [[B.x, B.y + 0.5 * B.hF, B.zRoot], [-B.x, B.y + 0.5 * B.hF, B.zRoot],
                      [B.x, B.y - 0.5 * B.hF, B.zRoot], [-B.x, B.y - 0.5 * B.hF, B.zRoot]]) };
    PIN_ROW.boomWa = { layer: 'root',
      fn: booms(B => [[B.x + B.r1, B.y, B.zTip], [-B.x - B.r1, B.y, B.zTip],
                      [B.x - B.r1, B.y, B.zTip], [-B.x + B.r1, B.y, B.zTip]]) };
    PIN_ROW.boomHa = { layer: 'root',
      fn: booms(B => [[B.x, B.y + 0.5 * B.hA, B.zTip], [-B.x, B.y + 0.5 * B.hA, B.zTip],
                      [B.x, B.y - 0.5 * B.hA, B.zTip], [-B.x, B.y - 0.5 * B.hA, B.zTip]]) };
    PIN_ROW.boomNoseLen = { layer: 'root', fn: booms(B => [[B.x, B.y, B.zFore], [-B.x, B.y, B.zFore]]) };
    PIN_ROW.boomTailLen = { layer: 'root', fn: booms(B => [[B.x, B.y, B.zAft], [-B.x, B.y, B.zAft]]) };
    const rod = fn => () => {
      const C2 = window.CAGE2, P = window.CAGE_UI && window.CAGE_UI.P;
      if (!C2 || !C2.cageSpec || !C2.cageResolve || !P) return [];
      const S = C2.cageSpec(Object.assign({}, P));
      if (!S.rod || S.rod.twin) return [];
      const R = C2.cageResolve(S);
      if (!R || !R.rodSpan) return [];
      const FS = (C2.CAGE_UNIT || 1) * (P.planeScale || 1);
      return fn(R.rodSpan, S.rod, S.taper || null).map(p => [p[0] * FS, p[1] * FS, p[2] * FS]);
    };
    PIN_ROW.rodY = { layer: 'root',
      fn: rod((sp, r) => [[0, r.y, sp.zRoot], [0, r.y, sp.zTip]]) };
    PIN_ROW.rodD = { layer: 'root',
      fn: rod((sp, r) => [[0, r.y + r.r, sp.zRoot], [0, r.y - r.r, sp.zRoot],
                          [0, r.y + r.r, sp.zTip], [0, r.y - r.r, sp.zTip]]) };
    // the taper's welded collar: taperLen aft of the bulkhead on a rod, the
    // taper pillar's station on a lofted boom
    PIN_ROW.taperLen = { layer: 'root',
      fn: rod((sp, r, t) => t ? [[0, r.y + r.r, sp.zRoot - t.len],
                                 [0, r.y - r.r, sp.zRoot - t.len]] : []) };
    // the cowl, by the feature each row shapes. `C` is COWL_GEN.
    const ring = (zf, n) => C => {
      const out = [], z = zf(C), N = n || 16;
      for (let i = 0; i < N; i++) {
        const p = C.surfPoint(i / N * Math.PI * 2, z);
        out.push([p[0], p[1], z]);
      }
      return out;
    };
    const surf = (thf, zf) => C => {
      const z = zf(C), th = thf(C), p = C.surfPoint(th, z);
      return [[p[0], p[1], z]];
    };
    const ZE = C => C.zEnd(), Z0 = () => 0, ZB = C => C.P.cowlLen;
    const COWL = {
      end: ring(ZE), face: ring(Z0), barrel: ring(ZB),
      seam: ring(C => Math.max(0, Math.min(1, C.P.seamPos)) * C.zEnd()),
      lobes: C => {
        const out = [], z = C.P.lobeT * C.zEnd(), D = Math.PI / 180;
        const azs = [C.P.lobeAz * D];
        if (C.P.lobeN >= 2) azs.push(Math.PI - C.P.lobeAz * D);
        for (const th of azs) {
          const p = C.surfPoint(th, z);
          out.push([p[0], p[1], z]);
        }
        return out;
      },
      cut: C => {
        const out = [], z = C.zEnd() * 0.98, D = Math.PI / 180;
        for (const s of [-1, 1]) {
          const th = (C.P.cutAz + s * C.P.cutSpan / 2) * D;
          const p = C.surfPoint(th, z);
          out.push([p[0], p[1], z]);
        }
        return out;
      },
      // the scoop's own mouth, from buildScoop's own two lines
      scoop: C => {
        const ze = C.zEnd();
        const y = C.spineY(ze * 0.6) -
          C.sectionAtZ(C.P.cowlLen * 0.5).bB * C.P.scoopDrop;
        const z1 = C.P.cowlLen + C.P.lidLen * 0.35;
        return [[0, y, z1], [0, y, z1 - C.P.scoopLen]];
      },
      oil: surf(() => Math.PI / 2, C => C.zEnd() *
        Math.max(0.05, Math.min(0.95, C.P.oilZ))),
      part: C => {
        const out = [], th0 = C.P.partY * Math.PI * 0.5, ze = C.zEnd();
        for (const z of [ze * 0.25, ze * 0.6, ze * 0.9])
          for (const th of [th0, Math.PI - th0]) {
            const p = C.surfPoint(th, z);
            out.push([p[0], p[1], z]);
          }
        return out;
      },
      aps: C => C.apertureList().map(o => [o.cx, o.cy, C.zEnd()]),
      pair: C => C.apertureList().slice(-2).map(o => [o.cx, o.cy, C.zEnd()]),
    };
    const cowlRows = {
      cowlLen: 'end', lidLen: 'end', lidR: 'end', lidGap: 'end',
      lidRound: 'end', lidMode: 'end', lidShoulder: 'end', faceRise: 'end',
      lipMode: 'end', lipThick: 'end', lipDepth: 'end', ductLen: 'end',
      lipProtrude: 'end', lipInset: 'end', lipRound: 'end', ductFlare: 'end',
      aftW: 'face', aftH: 'face', taperW: 'face', taperH: 'face',
      lidRise: 'face', deckH: 'face', waist: 'face', keelH: 'face',
      sqAftTop: 'face', sqAftBot: 'face',
      sqFrontTop: 'barrel', sqFrontBot: 'barrel',
      keelSweep: 'barrel', deckSweep: 'barrel', waistSweep: 'barrel',
      seamOn: 'seam', seamType: 'seam', seamPos: 'seam',
      seamWidth: 'seam', seamDepth: 'seam',
      lobeN: 'lobes', lobeAmp: 'lobes', lobeT: 'lobes', lobeAz: 'lobes',
      lobeSig: 'lobes', lobeTSig: 'lobes',
      cutSpan: 'cut', cutAz: 'cut',
      scoopOn: 'scoop', scoopLen: 'scoop', scoopW: 'scoop', scoopH: 'scoop',
      scoopSq: 'scoop', scoopLipH: 'scoop', scoopDrop: 'scoop',
      scoopRake: 'scoop', scoopAp: 'scoop', scoopLipDepth: 'scoop',
      scoopDuct: 'scoop',
      oilOn: 'oil', oilZ: 'oil', oilW: 'oil', oilL: 'oil', oilSq: 'oil',
      partOn: 'part', partY: 'part', partW: 'part',
      apMode: 'aps', apW: 'aps', apH: 'aps', apSq: 'aps',
      apOffX: 'aps', apOffY: 'aps',
      pairX: 'pair', pairW: 'pair', pairH: 'pair', pairY: 'pair',
      pairSq: 'pair',
    };
    for (const [k, at] of Object.entries(cowlRows))
      PIN_ROW['cw_' + k] = { layer: 'cowl', fn: COWL[at] };
  }

  // A DOT THE SAME SIZE WHEREVER IT IS. The offset is built in VIEW space from
  // the unit sphere's own vertex, so the layer's scale (the cage's mesh units
  // under planeScale, the cowl's metres) never reaches it and the dot is
  // `pinPx` output pixels across at any distance — the same pixel arithmetic
  // the silhouette rim learned, for the same reason.
  let pinMat = null, pinGeo = null, pinObjs = null, pinKey = null;
  function pinMaterial() {
    // THE PIN IS UI, NOT PAINT, and it is measured rather than assumed. Left
    // as an ordinary material it went through the room's ACES curve and its
    // 0.92 exposure and reached the frame at (222, 205, 154) — a pale cream,
    // which is very nearly the colour of the aeroplane it was supposed to
    // stand out against. Two corrections, both measured on the live page:
    //
    //   toneMapped: false   the dot is an instrument, so it does not dim with
    //                       the hangar's light. (222,205,154) -> (250,212,130)
    //   convertSRGBToLinear r128 has no colour management: a material colour
    //                       is taken as LINEAR and encoded on the way out, so
    //                       the amber named here arrived washed. Converting it
    //                       first is what makes the hex mean what it says —
    //                       (250,212,130) -> a real amber against the cream.
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(HI.pin).convertSRGBToLinear(),
      transparent: true, opacity: 0.95, toneMapped: false,
      depthTest: false, depthWrite: false, fog: false });
    m.onBeforeCompile = sh => {
      sh.uniforms.hiPinPx = { value: HI.pinPx };
      sh.uniforms.hiPinVH = { value: 1000 };
      sh.vertexShader = ('uniform float hiPinPx;\nuniform float hiPinVH;\n' +
        sh.vertexShader).replace(
        '#include <project_vertex>',
        ['vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
         'float hiDepth = projectionMatrix[3][3] > 0.5 ? 1.0 : -mvPosition.z;',
         'float hiPxWorld = 2.0 * hiDepth / ( projectionMatrix[1][1] * hiPinVH );',
         'mvPosition.xyz += position * hiPinPx * hiPxWorld * 0.5;',
         'gl_Position = projectionMatrix * mvPosition;'].join('\n'));
      m.userData.sh = sh;
    };
    m.userData.cageUni = 1;
    return m;
  }
  // EVERY HOST THAT WEARS THE NAME (G189). A twin-boom fin is two groups
  // with one name (the second a clone at −boomX), and a cowl's units each
  // sit in their own named group UNDER an identity root that wears the same
  // name — so "the first child called cageLayer:fin" was the port fin only,
  // and "the group called cageLayer:cowl" was the root with none of the
  // unit's face offset or its π turn: the user's dots on the cowl and on
  // the fins were on the wrong boom, or at the aeroplane's origin. A host
  // whose own children carry the name yields to them.
  const pinLayers = name => {
    const root = window.CAGE_UI_SCENE;
    if (!root) return [];
    if (name === 'root') return [root];     // scene-metre points, no layer
    const out = [];
    for (const c of root.children) {
      if (c.name !== 'cageLayer:' + name) continue;
      const kids = c.children.filter(k => k.name === 'cageLayer:' + name);
      if (kids.length) out.push(...kids); else out.push(c);
    }
    return out;
  };
  // the named tail vertices, resolved against the cage THIS BUILD made
  const pinTailPts = (cage, names) => {
    const out = [];
    if (!cage || !cage.IX || !cage.V) return out;
    for (const n of names) {
      const i = cage.IX[n];
      if (i === undefined || !cage.V[i]) continue;
      out.push(cage.V[i]);
    }
    return out;
  };
  function pinPoints(spec) {
    try {
      if (spec.layer === 'fin') {
        const F = window.CAGE_FIN;
        return F ? pinTailPts(F.cage, PIN_TAIL[spec.at] || []) : [];
      }
      if (spec.layer === 'stab') {
        const S = window.CAGE_STAB, G = window.FIN_GEN;
        if (!S || !S.lay || !G || !G.finToStab) return [];
        const src = pinTailPts(S.cage, PIN_TAIL[spec.at] || []);
        const out = [];
        // both sides: the fin has one tip, a tailplane has two
        for (const side of [1, -1])
          for (const p of src)
            out.push(G.finToStab({ V: [p], F: [] },
              Object.assign({ side }, S.lay)).V[0]);
        return out;
      }
      if (spec.layer === 'cowl') {
        const C = window.COWL_GEN;
        return (C && spec.fn) ? spec.fn(C) : [];
      }
      if (spec.layer === 'root') return spec.fn ? spec.fn() : [];
    } catch (e) {}
    return [];
  }
  function pinClear() {
    if (!pinObjs) return;
    for (const o of pinObjs) if (o.parent) o.parent.remove(o);
    pinObjs = null;
  }
  function pinBuild(key) {
    pinClear();
    pinKey = key || null;
    if (!pinKey || typeof THREE === 'undefined') return;
    const spec = PIN_ROW[pinKey];
    if (!spec) return;
    const hosts = pinLayers(spec.layer);
    if (!hosts.length) return;
    const pts = pinPoints(spec);
    if (!pts.length) return;
    if (!pinGeo) pinGeo = new THREE.SphereGeometry(1, 12, 8);
    if (!pinMat) pinMat = pinMaterial();
    const out = [];
    // the same LOCAL points in every host: a clone's frame is the original's
    // mirrored, a cowl unit's is its own face, and the point set was made in
    // the layer's own frame either way
    for (const host of hosts)
      for (const p of pts) {
        const m = new THREE.Mesh(pinGeo, pinMat);
        m.position.set(p[0], p[1], p[2]);
        m.renderOrder = 9;
        m.frustumCulled = false;       // the dot is bigger than its own geometry
        m.userData.edHi = 1;           // never the aeroplane: the capture skips it
        m.onBeforeRender = hiPxFeed;
        host.add(m);
        out.push(m);
      }
    pinObjs = out;
  }
  // THE ROW SAYS WHICH POINT. Delegated, because the rows are _cage_ui's own
  // elements moved in and out of this column on every selection — a listener
  // per row would be a listener per row per lifetime.
  if (rowsEl) {
    rowsEl.addEventListener('pointerover', e => {
      const r = e.target && e.target.closest ? e.target.closest('.r') : null;
      const k = r && r.dataset ? r.dataset.k : null;
      if (k !== pinKey) pinBuild(k);
    });
    rowsEl.addEventListener('pointerleave', () => pinBuild(null));
  }

  // the switch, live: no rebuild of the editor, just of the highlight
  window.EDITOR_HILITE = (o) => {
    if (!o) return Object.assign({}, HI);
    Object.assign(HI, o);
    try { localStorage.setItem(HI_PREF, JSON.stringify(HI)); } catch (e) {}
    hiMats = null;                      // colours live on the materials
    if (pinMat) { pinClear(); pinMat.dispose(); pinMat = null; }
    const sel = pinFor;
    hiClear('sel'); hiClear('hov');
    if (sel) hiBuild(sel, 'sel');
    // the display flyout's `selection` row says what the console just set
    { const ss = $('edSelStyle'); if (ss) ss.value = HI.mode; }
    return Object.assign({}, HI);
  };

  // ---- THE STYLE IS ON THE MENU (G131, the user: "There should also be an
  // option for display on the selection of parts, because I can't make up my
  // mind... Accessible from the display menu"). A real parked row, not a
  // flyout-built widget: it lives in the nursery, is listed by label in the
  // RAIL's `display` rows, and openFly borrows and returns it like any row
  // _cage_ui built — which also puts it in front of GATE VIEW, where it is
  // exempt WITH ITS REASON (VIEW_KEEP in tools/_cage_join.js: the highlight
  // is an edHi overlay and the capture skips those outright).
  {
    const row = document.createElement('div');
    row.className = 'r';
    row.title = 'How the selected part is shown';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = 'selection';
    const s = document.createElement('select');
    s.id = 'edSelStyle';
    for (const [v, label, why] of [
      ['outline',    'detail outline', 'every crease of the part, drawn'],
      ['silhouette', 'silhouette',     'one line around the whole part'],
      ['fill',       'soft glow',      'a pale wash over the whole part'],
      // reachable from the console, deliberately not offered on the menu —
      // hidden rather than absent so a console-set mode still reads back
      ['both',       'outline + glow', ''],
    ]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label;
      if (why) o.title = why; else o.hidden = true;
      s.appendChild(o);
    }
    s.value = HI.mode;
    s.onchange = () => window.EDITOR_HILITE({ mode: s.value });
    row.appendChild(k);
    row.appendChild(s);
    nursery.appendChild(row);
  }
  // ...and its neighbour: what a click on the covering SELECTS. Parked the
  // same way, listed in the RAIL's `display` rows the same way, and exempt in
  // VIEW_KEEP with the same kind of reason — it moves no vertex and touches
  // no material, so the flight capture cannot see it.
  {
    const row = document.createElement('div');
    row.className = 'r';
    row.title = 'What a click on the covering or a longeron selects';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = 'clicking';
    const s2 = document.createElement('select');
    s2.id = 'edPickMode';
    for (const [v, label, why] of [
      ['bay',   'the bay you clicked',
       'the fuselage sliced into its sections: nose, cabin, bays, boom, tail'],
      ['whole', 'the whole fuselage',
       'the covering answers with the assembly, as it did before the ' +
       'sections existed'],
    ]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = label; o.title = why;
      s2.appendChild(o);
    }
    s2.value = pickBay ? 'bay' : 'whole';
    s2.onchange = () => window.EDITOR_PICKMODE(s2.value);
    row.appendChild(k);
    row.appendChild(s2);
    nursery.appendChild(row);
  }
  // ...and a third, G144: HOW SMOOTH THE PICTURE IS. Parked the same way and
  // listed in the RAIL's `display` rows the same way, because it answers the
  // same kind of question the other two do — what the build is DRAWN as — even
  // though this one is about the frame rather than about the part.
  //
  // It reads the pass LAZILY, through window.FLYDIY_AA, because this block is
  // built by editorInit and a viewer assembled in a different order (or a card
  // that cannot carry the pass at all) must still get a row that tells the
  // truth rather than a row that throws. When the card cannot carry it the
  // select says so and is disabled: an option that silently does nothing is
  // worse than an option that is visibly not available.
  {
    const row = document.createElement('div');
    row.className = 'r';
    row.title = 'How much work goes into smoothing edges and gradients';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = 'smoothing';
    const s3 = document.createElement('select');
    s3.id = 'edAATier';
    const aa0 = (typeof window !== 'undefined' && window.FLYDIY_AA) || null;
    const TIERS = (typeof window !== 'undefined' && window.AA_RESOLVE &&
                   window.AA_RESOLVE.TIERS) || {};
    for (const v of ['off', 'msaa', 'full']) {
      const t = TIERS[v];
      if (!t) continue;
      const o = document.createElement('option');
      o.value = v; o.textContent = t.label; o.title = t.why;
      s3.appendChild(o);
    }
    if (aa0 && aa0.able()) {
      s3.value = aa0.tier();
    } else {
      s3.value = 'off';
      s3.disabled = true;
      row.title = 'This card cannot carry the resolve pass — 4x MSAA only';
    }
    s3.onchange = () => {
      const aa = (typeof window !== 'undefined' && window.FLYDIY_AA) || null;
      if (aa) s3.value = aa.setTier(s3.value);   // the pass reports what it took
    };
    // THE PASS IS THE KEEPER AND THIS SELECT IS ONLY A READER (G144.2): the
    // flight screen's camera flyout presses the same tier, and a select built
    // once at editorInit would go on showing the old answer after a change
    // made over there. The flight pills stay honest by being rebuilt on every
    // open; this row stays honest by re-reading on approach.
    row.addEventListener('pointerenter', () => {
      const aa = (typeof window !== 'undefined' && window.FLYDIY_AA) || null;
      if (aa && aa.able()) s3.value = aa.tier();
    });
    row.appendChild(k);
    row.appendChild(s3);
    nursery.appendChild(row);
  }
  // the switch, live and reachable from the console like the highlight's
  window.EDITOR_PICKMODE = (v) => {
    if (v == null) return pickBay ? 'bay' : 'whole';
    pickBay = v !== 'whole';
    pref(LS_PICK, pickBay ? 'bay' : 'whole');
    const el = $('edPickMode');
    if (el) el.value = pickBay ? 'bay' : 'whole';
    return pickBay ? 'bay' : 'whole';
  };
  function hiClear(which) {
    const g = which === 'sel' ? hiSel : hiHov;
    if (!g) return;
    for (const o of g) {
      if (o.parent) o.parent.remove(o);
      // THE OUTLINE OWNS ITS GEOMETRY and the fill does not: the fill shares
      // the cage's position buffer or re-uses the layer mesh's own geometry,
      // while EdgesGeometry allocates. Without this, every hover leaks one.
      if (o.userData && o.userData.edOwnGeo && o.geometry) o.geometry.dispose();
    }
    if (which === 'sel') hiSel = null; else hiHov = null;
  }
  // which part the selection highlight was built for. It was the callout's
  // anchor too until the callout went; the highlight-colour switch above still
  // needs to know what to rebuild.
  let pinFor = null;

  // WHICH NAMED OBJECT a mesh belongs to — the nearest name on the way up,
  // the same walk `ownerOf` does, stopping one step earlier. Used to narrow a
  // hover to the ONE instance under the pointer.
  const instOf = (o, layerRoot) => {
    for (let p = o; p && p !== layerRoot; p = p.parent) if (p.name) return p.name;
    return '';
  };

  // `only` narrows a LAYER highlight to the named instance under the pointer
  // (the user: "tyres could be highlighted individually"). It is a NAME, not
  // an object: app.js owns the scene graph and this file does not, and the
  // hit already carries the nearest name for exactly this kind of question.
  // The cage branch ignores it — a section is not an instance.
  //
  // DECLARED: the two main wheels are built as two groups with the SAME name
  // (`edWheel` + the station's kind, _cage_gear.js:240), because they are one
  // kit at one set of parameters. So a main tyre lights its PAIR and the
  // tailwheel lights alone. Giving them separate names is the gear layer's
  // call to make, not this file's to work around.
  function hiBuild(partKey, which, only) {
    hiClear(which);
    const root = window.CAGE_UI_SCENE;
    // HIGHLIGHTING THE WHOLE AEROPLANE IS NOT A HIGHLIGHT. The root selects
    // everything, and an overlay over everything is a tint over a tint — it
    // says nothing and costs a copy of every index in the build.
    if (!partKey || partKey === 'craft' || !root ||
        typeof THREE === 'undefined') return;
    if (!hiMats) hiMats = { sel: hiMat(0.34), hov: hiMat(0.16),
                            selL: hiLine('sel'), hovL: hiLine('hov'),
                            selM: hiSilMask('sel'), hovM: hiSilMask('hov'),
                            selS: hiSilShell('sel'), hovS: hiSilShell('hov') };
    const mat = hiMats[which];
    const wantFill = HI.mode === 'fill' || HI.mode === 'both';
    const wantLine = HI.mode === 'outline' || HI.mode === 'both';
    const wantSil = HI.mode === 'silhouette';
    const out = [];
    // every part shown under this key — selecting an assembly lights all of it
    const parts = partsShown(partKey).filter(exists);
    const want = new Set(), layers = new Set(), keys = new Set();
    // THE BAYS THIS SELECTION NAMES. A part that IS a body zone (the nose,
    // the cabin, a passenger bay) owns no covering material of its own — the
    // covering is one material and the assembly owns it — so it asks for its
    // STATIONS instead, and the zoned sections below are cut to them. `null`
    // means the selection named no bay at all, and then nothing is cut:
    // `window joints` selected on its own lights every seal on the aeroplane,
    // which is what that part is.
    //
    // THERE IS NO EXCEPTION FOR THE ASSEMBLY, and there was one here for a
    // day. Selecting the Fuselage NAMES EVERY BAY (they are all under it) and
    // the zones partition the covering, so "all of it" falls out of the same
    // rule — while `Cabin`, which owns the seals through its `window joints`
    // child, still gets the cabin's seals and not the tail's. An exception
    // for a part that owns a zoned section outright would have handed the
    // cabin every seal on the aeroplane, which is the bug this replaced.
    let zones = new Set();
    for (const p of parts) {
      for (const s of (p.sections || [])) want.add(s);
      if (p.zone) zones.add(p.zone);
      if (p.layer && p.layer !== 'cage') layers.add(p.layer);
      keys.add(p.key);
    }
    if (!zones.size) zones = null;
    if (zones && PT.CAGE_ZONED) for (const s of PT.CAGE_ZONED) want.add(s);
    // A LAYER IS PARTITIONED, NOT FILTERED. The first cut narrowed a layer to
    // the meshes whose name maps to the selected part, which is right for the
    // named minority and wrong for everything else: `wingPanel` owns the wing,
    // and the only NAMED thing in the wing layer is the pitot — so selecting
    // the wing lit a pitot mast and nothing else. Every mesh belongs to
    // somebody: the part its nearest name maps to, or the layer's default part
    // if no name on the way up maps to anything.
    const ownerOf = (o, layerRoot, def) => {
      for (let p = o; p && p !== layerRoot; p = p.parent) {
        const n = p.name || '';
        if (!n) continue;
        for (const [re, key] of HIT_NAME) if (re.test(n)) return key;
      }
      return def;
    };
    for (const child of root.children) {
      // THE CAGE: one draw group per section, so the highlight is an index
      // subset over the SAME position buffer — no copy, and it costs a typed
      // array of the selected groups' indices.
      const nm = child.userData && child.userData.matNames;
      if (nm && want.size) {
        const src = child.geometry, idx = src.getIndex();
        if (!idx) continue;
        // typed subarrays, not a getX loop: this runs at the end of every
        // build, and a build happens on every pixel of a slider drag over a
        // mesh with a hundred thousand triangles in it
        //
        // A ZONED GROUP IS CUT TO THE SELECTED STATIONS. The covering is one
        // draw group from the firewall to the tail, so "the nose" is a RANGE
        // OF Z inside it and not a group of its own. Each triangle goes to
        // the zone its CENTROID stands in — a centroid, because a face that
        // straddles a pillar belongs to the bay it is mostly in, and testing
        // a corner instead leaves a sliver of the neighbouring bay lit along
        // every station. The table is the mesh's own (_cage_ui.js publishes
        // what the build was made with), so it is in the same coordinates the
        // positions are, and no scale enters.
        const zTable = zones && child.userData.bodyZones;
        const pos = src.getAttribute('position');
        // ASKING FOR EVERY BAY IS ASKING FOR THE WHOLE COVERING — the
        // Fuselage, and any selection that happens to name the lot. The
        // filter would keep every triangle at the cost of walking them all.
        const zAll = !!zTable && zTable.every(q => zones.has(q.key));
        const zoneOf = z => {
          for (const q of zTable) if (z >= q.z0) return q.key;
          return zTable[zTable.length - 1].key;
        };
        const runs = [];
        let n = 0;
        for (const g of src.groups) {
          const gm = nm[g.materialIndex];
          if (!want.has(gm)) continue;
          if (zones && !zAll && PT.CAGE_ZONED.has(gm)) {
            // no station table on this mesh is not a reason to light the
            // whole aeroplane: it is a reason to light none of the covering
            if (!zTable || !zTable.length || !pos) continue;
            const ia = idx.array, pa = pos.array;
            const cut = new ia.constructor(g.count);
            let k = 0;
            for (let i = g.start, e = g.start + g.count; i + 2 < e; i += 3) {
              const a = ia[i], b = ia[i + 1], c = ia[i + 2];
              const zc = (pa[a * 3 + 2] + pa[b * 3 + 2] + pa[c * 3 + 2]) / 3;
              if (!zones.has(zoneOf(zc))) continue;
              cut[k++] = a; cut[k++] = b; cut[k++] = c;
            }
            if (k) { runs.push(cut.subarray(0, k)); n += k; }
            continue;
          }
          runs.push(idx.array.subarray(g.start, g.start + g.count));
          n += g.count;
        }
        if (!n) continue;
        const keep = new idx.array.constructor(n);
        let at = 0;
        for (const r of runs) { keep.set(r, at); at += r.length; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', src.getAttribute('position'));
        // the shell inflates along normals; SHARED like the positions are,
        // which is also why this subset geometry is never disposed (disposing
        // a shared attribute would pull the cage's own buffer out from under
        // it — the same reason the fill does not own its geometry)
        if (src.getAttribute('normal'))
          geo.setAttribute('normal', src.getAttribute('normal'));
        geo.setIndex(new THREE.BufferAttribute(keep, 1));
        if (wantFill) {
          const m = new THREE.Mesh(geo, mat);
          m.scale.copy(child.scale);
          m.renderOrder = 6;
          m.userData.edHi = 1;
          child.parent.add(m);
          out.push(m);
        }
        if (wantLine) {
          const l = hiEdges(geo, which);
          l.scale.copy(child.scale);
          child.parent.add(l);
          out.push(l);
        }
        if (wantSil)
          out.push(...hiSilPair(geo, which, child.parent, child.scale));
        continue;
      }
      const ln = (child.name || '');
      if (ln.lastIndexOf('cageLayer:', 0) !== 0) continue;
      if (!layers.has(ln.slice(10))) continue;
      // A LAYER: its meshes, re-drawn as children of themselves so the whole
      // transform chain comes for free.
      const def = layerDefault(ln.slice(10));
      child.traverse(o => {
        // a SKINNED mesh is never re-drawn: r128 would draw its geometry at
        // the bind pose (G204.2) — its dummy's invisible shells stand for it
        if (!o.isMesh || o.isSkinnedMesh || (o.userData && o.userData.edHi)) return;
        if (!keys.has(ownerOf(o, child, def))) return;
        if (only && instOf(o, child) !== only) return;
        if (wantFill) {
          const m = new THREE.Mesh(o.geometry, mat);
          m.renderOrder = 6;
          m.userData.edHi = 1;
          o.add(m);
          out.push(m);
        }
        if (wantLine) { const l = hiEdges(o.geometry, which); o.add(l);
                        out.push(l); }
        if (wantSil) out.push(...hiSilPair(o.geometry, which, o));
      });
    }
    if (which === 'sel') { hiSel = out; pinFor = partKey; }
    else hiHov = out;
  }

  // ---- THE CALLOUT IS GONE (the user: "the highlight is clear, please
  // remove the pop up info on hover, it hides the part we're just looking
  // at"). It was the design's, and the design was right that a selected part
  // should say what it is — but it says it in the properties column's header
  // already, and over the aeroplane it sat on the one thing it was naming.
  // The highlight names the part by BEING the part, which needs no label.
  //
  // Going with it: the world-point pin, the per-frame re-projection, and
  // app.js's projectPoint, which existed for nothing else.
  // CLICKING WHAT IS ALREADY SELECTED STEPS OUT (the user: "You may suggest an
  // intuitive way to select the whole fuselage"). Once the covering and the
  // longerons are sliced into bays there is nothing left on the aeroplane
  // that selects the whole fuselage, and it still has rows of its own — the
  // waist line, the section rounding, the creases — so it has to be
  // reachable. This is the way up, and it is the same gesture repeated:
  // click the nose, click it again for the Fuselage, again for My Plane.
  //
  // A SECOND GESTURE WAS THE OTHER CANDIDATE (double-click, which the user
  // suggested, on the aeroplane or outside it). This won because it needs
  // nothing to discover — you find it by clicking twice, which people do —
  // and because it is reversible: one click on anything else puts you back on
  // a bay. Double-click outside also already means something (it recentres
  // the view), and "outside the aeroplane" is a strange place to say
  // "fuselage" from. A part with no parent stays where it is rather than
  // wrapping round to the leaves.
  //
  // IT IS THE SAME SPOT CLICKED AGAIN, NOT AN ANCESTOR SELECTED. The first
  // cut asked "is what is selected this part or one of its parents?", which
  // reads the same and is not: with the Fuselage selected, EVERY bay is a
  // descendant, so clicking the passenger bay stepped out to My Plane instead
  // of selecting the bay. So what is remembered is the part the last click
  // RESOLVED TO — click the same one again and you go up from wherever the
  // selection now is, click a different one and you land on it.
  const stepOut = k => {
    const p = PT.partByKey[k];
    if (!p || p.root) return k;
    return p.parent || 'craft';
  };
  let lastPick = null;

  // app.js hands a HIT down on click, and on hover while nothing is dragging
  let hovKey = null, hovInst = '';
  window.EDITOR_PICK = (hit, hover) => {
    const key = partOfHit(hit);
    const inst = (hit && hit.name) || '';
    if (!hover) {
      // CLICKING OUTSIDE THE AEROPLANE DESELECTS (the user). The root is the
      // "everything visible" row G102 introduced, so a miss goes UP rather
      // than nowhere — the column always says what it is showing. `hit.miss`
      // is app.js's own answer to "the ray was cast and hit nothing"; a bare
      // null means the question was never asked and must change nothing.
      if (key) {
        // WHICH TANK, not just "a tank" (2026-09-05, the user: "the ability to
        // select visually the reservoir"). A part is one tree row, and the
        // energy layer holds a LIST under it — so the layer's own mesh names
        // say which entry was struck and the panel opens on that one. Told
        // BEFORE the selection, so the column it builds is already the right
        // vessel's. Clicking a second tank therefore lands on that tank
        // instead of stepping out, which is what `lastPick` is reset for.
        const inst2 = instanceOfHit(hit);
        if (inst2) lastPick = null;
        select(key === lastPick ? stepOut(sel) : key);
        lastPick = key;
      } else if (hit && hit.miss) {
        select('craft');
        lastPick = null;
      }
      return;
    }
    if (key === hovKey && inst === hovInst) return;
    hovKey = key; hovInst = inst;
    hiBuild(key === sel ? null : key, 'hov', inst);
    // ...and the tree says which row it is, which is the other half of the
    // design's "hover" — a tint you cannot name is a tint.
    for (const d of treeEl.children)
      d.classList.toggle('hov', !!key && d.dataset.p === key);
  };

  // =========================================================================
  // WIRING
  // =========================================================================
  {
    const rp = $('edResetPart'); if (rp) rp.onclick = resetPart;
    const t1 = $('edTabShape'); if (t1) t1.onclick = () => setView('shape');
    const t2 = $('edTabFinish'); if (t2) t2.onclick = () => setView('finish');
    const t3 = $('edTabDesign'); if (t3) t3.onclick = () => setView('design');
    // NEW > Custom build and the tiles' own "back" pill switch the view
    window.EDITOR_SET_VIEW = setView;
    wrap.classList.toggle('fin', view === 'finish');
    if (t1) t1.classList.toggle('on', view === 'shape');
    if (t2) t2.classList.toggle('on', view === 'finish');
    if (t3) t3.classList.toggle('on', view === 'design');
    // THE SECTION LIST CHANGED SHAPE and the finish view is holding its rows.
    //
    // These are the one borrowed set that gets REPLACED rather than returned.
    // buildMatPanel has already emptied its body and built a fresh row for
    // every section; the nodes in this column are the previous set, and they
    // describe an aeroplane that no longer exists. Parking them would put them
    // back into the body beside their replacements — and the next render would
    // then borrow both, which is a column of doubled sliders that grows by one
    // set per construction change. So they are dropped, not parked, and the
    // drop is keyed on the HOME rather than on the class: the decals panel is
    // built once and its rows really do go back.
    window.CAGE_ON_MAT = () => {
      const mb = CU && CU.MATBODY;
      if (mb) for (const el of Array.from(rowsEl.children))
        if (homeOf.get(el) === mb) { homeOf.delete(el); el.remove(); }
      if (view === 'finish') render();
    };
    const ex = $('edExpert');
    if (ex) ex.onclick = () => setExpert(!(CU && CU.EXPERT && CU.EXPERT.on));
    // FOLD / OPEN EVERY SECTION. One button with two jobs, exactly as the
    // tree's own — and it writes an EXPLICIT choice for every heading on
    // screen, because "collapse all" that the rule then re-opens on the next
    // build is not a setup anybody could call remembered.
    const sa = $('edSecAll');
    if (sa) sa.onclick = () => {
      const shutAll = secAllWants() === 'fold';
      for (const g of groupsOf) {
        if (!g.head || g.head.classList.contains('hide')) continue;
        secPref.set(secKey(g.part.key, g.group), shutAll);
      }
      saveSec();
      applyVis();
    };
    const c1 = $('edCollapse'); if (c1) c1.onclick = () => setCollapsed(true);
    const p1 = $('edPropFold'); if (p1) p1.onclick = () => setPropsOff(true);
    const p2 = $('edPropsTab'); if (p2) p2.onclick = () => setPropsOff(false);
    // FOLD ALL / OPEN ALL. One button with two jobs, because it is one
    // question: is the tree showing me everything, or its shape? It folds
    // every branch that HAS one — including the roots — and the second press
    // opens the lot.
    const fa = $('edFoldAll');
    // the label is the button's own state and the fold set is PERSISTED, so it
    // has to be right before the first click and not after it
    const foldLabel = () => { if (fa) fa.textContent = folded.size ? 'open all' : 'fold all'; };
    foldLabel();
    if (fa) fa.onclick = () => {
      if (folded.size) folded.clear();
      else {
        for (const r of ROOTS) if (r.parts) folded.add(r.key);
        for (const p of PT.CAGE_PARTS)
          if (!p.root && PT.CAGE_PARTS.some(c => c.parent === p.key))
            folded.add(p.key);
      }
      saveFolded(); treeSig = ''; paintTree();
      foldLabel();
    };
    const c2 = $('edPartsTab'); if (c2) c2.onclick = () => setCollapsed(false);
    // THE EDITOR'S OWN OPTIONS START CLOSED. They are not the aeroplane, and
    // open they take a third of the column off the inspector — which is the
    // shape of the screen this chantier is replacing. One click opens them,
    // and the choice persists. (G78 takes them out of this column entirely.)
    const oh = $('edOptsHead');
    wrap.classList.toggle('opts-off', pref(LS_OPTS) !== '1');
    if (oh) oh.onclick = () => {
      const off = wrap.classList.toggle('opts-off');
      pref(LS_OPTS, off ? '0' : '1');
    };
    wrap.classList.toggle('pcol-off', partsAway());
    wrap.classList.toggle('prop-off', propsOff);
    layoutRight();
    // ---- the view layer -------------------------------------------------
    buildRail();
    buildQuick();
    // THE INFORMATION PANEL FOLDS, like the parts column. Four columns is
    // 920 px of chrome and a 1440 frame has 520 px of render left; on a
    // narrow screen this is the one to give back first, because a verdict
    // can be re-opened and a shape cannot be edited from memory.
    const foldInfo = on => {
      infoOff = !!on;
      pref(LS_INFO, infoOff ? '1' : '0');
      document.body.classList.toggle('info-off', infoOff);
    };
    const fi = $('edInfoFold'); if (fi) fi.onclick = () => foldInfo(true);
    const fit = $('edInfoTab'); if (fit) fit.onclick = () => foldInfo(false);
    foldInfo(pref(LS_INFO) === '1');
    // ESC closes whatever is over the view, innermost first
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (flyOpen) openFly(null);
    });
    // THE VERBS. Roll out is the game's own #bGo — the same handler, not a
    // second one: a duplicate would be a second place that decides whether the
    // editor is committed before the aeroplane flies.
    const roll = $('edRoll');
    if (roll) roll.onclick = () => {
      releaseView();
      const go = document.getElementById('bGo');
      if (go && go.onclick) go.onclick();
    };
    // RUN THE BENCH IS GONE FROM THE VIEW (the user: "run the bench is
    // available only via the information panel"). It never did anything of
    // its own: it scrolled to `#bTests` and clicked `#bRunAll`, and both of
    // those have been ON SCREEN, in the information panel, since G91 put the
    // bench there. A button whose whole job is to press another visible
    // button is a second door to one room.
    //
    // (the old #edSave verb retired 2026-08-31: SAVE lives on the file
    // ribbon now — the shelf's own #gSave, one handler, one meaning)
    // ANYTHING THE BUILDER DOES ends the settling window above. Capture, so it
    // is seen before the handler it belongs to runs — which is what lets the
    // shelf's own `change` re-open the window for the design it loads. `click`
    // is in the list because the stepper's ± and the `= front` button write
    // through the row's callback and fire no input event of their own.
    for (const ev of ['input', 'change', 'click'])
      wrap.addEventListener(ev, () => { touched = true; }, true);
  }

  // the two hooks _cage_ui.js gained. ON_ROWS fires once, before the first
  // build; ON_VIS fires at the end of every visibility pass, which is the end
  // of every build and every syncSliders — so the dots, the tree and the row
  // rules all follow a slider drag without anything polling.
  window.CAGE_ON_ROWS = () => {
    adopt();
    setExpert(pref('cageExpert') === '1');
    // WHATEVER WAS STANDING THERE LAST TIME COMES BACK, and it comes back
    // whether or not the reference row is the selection — you park a Cub next
    // to your build in order to look at it while you work on the wing, not in
    // order to look at the reference panel.
    if (window.REFPLANE) window.REFPLANE.boot();
    select(sel);
  };
  window.CAGE_ON_VIS = applyVis;
  // app.js calls this when the editor leaves the screen (rolling out):
  // nothing should be left floating over a view that is now the world.
  window.EDITOR_RELEASE = releaseView;
  // app.js calls this straight after CAGE_PAGE_SETUP, which is what injects
  // the derived selectors. It is a separate hook because that call is the
  // GAME's (openEditor makes it); the bench pages make it themselves and have
  // no editor panel to tell.
  window.CAGE_ON_PAGE = collectDerived;
}
