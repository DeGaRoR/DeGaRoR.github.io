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
  registerRoot({ key: 'craft', name: 'Build plane', order: 0, parts: true });
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
  let view = pref(LS_VIEW) === 'finish' ? 'finish' : 'shape';
  // WHERE A BORROWED ELEMENT GOES BACK TO. The parameter rows have one home
  // (the nursery) and need no map; the finish rows have two — the materials
  // panel's body and the decals panel's — and `buildMatPanel` clears its body
  // by `textContent = ''`, which only reaches the rows that are still IN it. A
  // row left in the inspector across a rebuild is a row that outlives the
  // aeroplane it describes.
  const homeOf = new WeakMap();
  let collapsed = pref(LS_COL) === '1';
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
    // 5. THE ROOM GOES TO THE SHED SHEET, whole. The user's ruling: tuning the
    //    atmosphere or the hangar is a different interface from designing an
    //    aeroplane. The `night` flyout borrows its two light rows back and
    //    returns them.
    {
      const hd = document.querySelector('#cgUi details[data-g="hangar"]');
      const body = $('shedBody');
      if (hd && body) { hd.open = true; body.appendChild(hd); }
    }
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
  const DERIVED = {
    '2 · engine': ['engine', 'fitted'],
    '4 · cabin/dimensions': ['cabin', 'dimensions'],
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
  // THE INSPECTOR
  // =========================================================================
  // Rebuilt on selection, not on every parameter change: moving DOM nodes
  // under the user's cursor while they drag a slider is how a panel loses a
  // drag. Visibility and the changed dots are updated in place instead.
  const groupsOf = [];                     // [{head, part, group, rows}]

  function render() {
    if (!CU) return;
    groupsOf.length = 0;
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
        return;
      }
    }
    if (view === 'finish') { renderFinish(); applyVis(); return; }
    const shown = partsShown(sel);
    const many = shown.length > 1;
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
        h.className = 'edH';
        h.innerHTML = '<span></span><i></i>';
        h.firstChild.textContent = nameOf(p);
        rowsEl.appendChild(h);
        groupsOf.push({ head: h, part: p, group: null, rows: [] });
      }
      // THE PLACEMENT STRIP (P8 §5): fore/aft, up/down, length, width — same
      // order on every part, before anything else, under one heading that
      // names the anchor the part is placed against. The rows keep their own
      // labels: the design shows `base lift · top offset · run` here, not four
      // renamed sliders, and renaming a row in one context and not another is
      // how a glossary rots.
      if (p.place) {
        const keys = ['fore', 'up', 'len', 'wide']
          .map(s => p.place[s]).filter(Boolean);
        if (keys.length) emit(p, 'placement', keys, p.place.at, false);
      }
      for (const g of (p.groups || [])) {
        const isExp = g[2] === PT.EXPERT;
        // the placement rows are re-presented above, not repeated here
        const keys = p.place
          ? g[1].filter(k => !['fore', 'up', 'len', 'wide']
              .some(s => p.place[s] === k))
          : g[1];
        if (keys.length) emit(p, g[0], keys, null, isExp);
      }
    }
    applyVis();
  }

  function emit(part, name, keys, meta, expert) {
    const h = document.createElement('div');
    h.className = 'edH';
    h.innerHTML = '<span></span><i></i><em></em>';
    h.children[0].textContent = name;
    h.children[2].textContent = meta || '';
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
  function emitEls(part, name, els, meta) {
    if (!els.length) return;
    const h = document.createElement('div');
    h.className = 'edH';
    h.innerHTML = '<span></span><i></i><em></em>';
    h.children[0].textContent = name;
    h.children[2].textContent = meta || '';
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
    groupsOf.push({ head: h, part, group: name, rows: [], els, finish: true });
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
    const bySec = new Map(), head = [];
    for (const el of Array.from(body.children)) {
      const s = el.dataset && el.dataset.sec;
      if (s) { if (!bySec.has(s)) bySec.set(s, []); bySec.get(s).push(el); }
      // `derived` is the bench's read-out of the construction; the live row is
      // taken from the part table below and this would be its dead twin
      else if (el.dataset && el.dataset.matHead === '1') head.push(el);
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
      // THE CONSTRUCTION IS THE FIRST DECISION AND IT IS LIVE HERE. The user
      // asked where "the conception slider, the one where we decide the
      // materials and architecture of the plane" had gone: it is `intCons`,
      // which the part table gives to `structure` because that is the part it
      // dimensions. It is also the row every section's `auto (…)` finish is
      // derived from, so showing only its RESULT at the head of the livery —
      // as this panel did — is a read-out with no way back to the choice.
      // The row itself comes here instead. It is the same element, so it is
      // in exactly one place at a time and the shape view takes it back on the
      // next selection, which is what re-parenting buys.
      const cons = [];
      for (const m of (rowsFor.get('intCons') || [])) cons.push(m.row);
      emitEls(p0, 'livery', cons.concat(head), 'the whole aeroplane');
      const dec = CU.DECBODY;
      if (dec) emitEls(p0, 'markings',
        Array.from(dec.children), 'registration and images');
    }
    for (const p of shown) {
      const els = [];
      for (const s of (p.sections || [])) {
        const r = bySec.get(s);
        if (!r || taken.has(s)) continue;
        taken.add(s);
        for (const el of r) els.push(el);
      }
      emitEls(p, nameOf(p), els, els.length ? '' : '');
    }
    // ANYTHING THE TABLE HAS NOT CLAIMED still gets a home. GATE PARTS says
    // there is nothing here on a build it knows; a layer added since is a row
    // the player can still reach rather than a control that silently vanished.
    if (isRoot) {
      const rest = [];
      for (const [s, r] of bySec) if (!taken.has(s)) for (const el of r) rest.push(el);
      emitEls(p0, 'unclaimed', rest, 'not yet in the part table');
    }
    // A PART WITH NO SECTION IS NOT A PART WITH NO MATERIAL. Only the cage's
    // own skin is sectioned; a wing, a cowl or a leg is either the aeroplane's
    // construction — one choice, on the root — or hardware, whose finishes are
    // declared in AEROSKIN's AERO_HARD table and are not the builder's to pick
    // (a tyre is rubber and a chromed oleo piston is chrome). So the note says
    // where the finish DOES come from, and takes you there.
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
    view = v === 'finish' ? 'finish' : 'shape';
    pref(LS_VIEW, view);
    wrap.classList.toggle('fin', view === 'finish');
    const a = $('edTabShape'), b = $('edTabFinish');
    if (a) a.classList.toggle('on', view === 'shape');
    if (b) b.classList.toggle('on', view === 'finish');
    render();
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
    // the changed set, computed ONCE per pass and read by every badge and by
    // `reset part`. It covers every row, not just the ones on screen, because
    // the tree's dots are about parts you are not looking at.
    dirty.clear();
    for (const [k, ms] of rowsFor) if (dirtyOf(ms[0], P)) dirty.add(k);
    let changedHere = 0;
    for (const g of groupsOf) {
      let live = 0;
      const partOk = exists(g.part);
      // A FINISH GROUP HAS NO ROWMETA. Its elements are the materials panel's,
      // which carry no `when` and no key — the only rule that reaches them is
      // whether the part they describe is on this aeroplane at all.
      if (g.finish) {
        const want = partOk ? '' : 'none';
        for (const el of g.els) if (el.style.display !== want) el.style.display = want;
        g.head.classList.toggle('hide', !partOk);
        continue;
      }
      for (const m of g.rows) {
        let vis = partOk && !(g.expert && !ex);
        if (vis) {
          const o = m.opts || {};
          if (o.level === 'expert' && !ex) vis = false;
          if (vis && o.when) { try { vis = !!o.when(P); } catch (e) {} }
        }
        if (vis) for (const w of (inherited.get(m.row) || [])) {
          try { if (!w(P)) { vis = false; break; } } catch (e) {}
        }
        // WRITE ONLY WHEN IT CHANGED. This runs at the end of every build, and
        // a build happens on every pixel of a slider drag — with the root
        // selected that is 537 rows. Style and class writes on unchanged
        // values are what turn a drag into a stutter.
        //
        // Compared against the DOM, not against a remembered value: _cage_ui's
        // own applyRowVis has just written display on every row that carries
        // its own `when`, and a cache would happily agree with itself while
        // the element said something else.
        const want = vis ? '' : 'none';
        if (m.row.style.display !== want) m.row.style.display = want;
        if (!vis) continue;
        live++;
        // THE CHANGED DOT (P8 §6) — see `dirtyOf` and the note above it.
        const chg = dirty.has(m.k);
        if (m.row.classList.contains('chg') !== chg)
          m.row.classList.toggle('chg', chg);
        if (chg) changedHere++;
      }
      // a heading with nothing under it is a heading about nothing. Part
      // headings (group === null) follow their part instead.
      g.head.classList.toggle('hide',
        g.group === null ? !partOk : (live === 0));
    }
    // THE REFERENCE'S GAP FOLLOWS THE BUILD. applyVis is the end of every
    // build and every syncSliders, which is exactly when the geometry the
    // discrepancy line was measured against has been replaced.
    { const r = rootFor(sel); if (r && r.refresh) r.refresh(); }
    const cEl = $('edChanged');
    if (cEl) cEl.textContent = changedHere ? changedHere + ' changed' : '';
    paintTree();
    paintInfo();
    // THE HIGHLIGHT IS REBUILT WITH THE AEROPLANE. The cage's geometry and
    // every layer's group are thrown away and remade on each build, and the
    // overlay hangs off both — so it has to be remade with them, or the tint
    // silently belongs to a mesh that no longer exists.
    hiBuild(sel === 'craft' ? null : sel, 'sel');
    hovKey = null; hiClear('hov');
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
        if (!exists(p)) continue;
        rows.push({ p, lvl, name: nameOf(p), kids: hasKids(p.key) });
        // a FOLDED assembly keeps its own row and hides what is under it
        if (folded.has(p.key)) continue;
        walk(p.key, lvl + 1);
      }
    };
    const hasKids = k => PT.CAGE_PARTS.some(c => c.parent === k && exists(c));
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
      let up = PT.partByKey[sel];
      while (up && up.parent && !rows.some(r => r.p.key === up.key))
        up = PT.partByKey[up.parent];
      select(up && rows.some(r => r.p.key === up.key) ? up.key : 'craft');
      return;
    }
    const badges = rows.map(r => (r.rootDef && r.rootDef.badge)
      ? (r.rootDef.badge() || '') : partBadge(r.p));
    const sig = rows.map((r, i) => r.p.key + r.lvl + r.name + badges[i] +
      (folded.has(r.p.key) ? '>' : '')).join('|') + '#' + sel;
    if (sig === treeSig) return;
    treeSig = sig;
    treeEl.textContent = '';
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'edN lv' + Math.min(2, r.lvl) +
        (r.p.root ? ' root' : '') + (r.p.key === sel ? ' on' : '');
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
      } else if (r.lvl < 2) {
        const t = document.createElement('u');
        t.className = 'fold none';
        d.appendChild(t);
      }
      const s = document.createElement('span');
      s.textContent = r.name;
      s.title = r.name;
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
      if (!exists(q)) continue;
      for (const k of PT.cagePartParams(q)) if (dirty.has(k)) out.push(k);
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
  }

  // ONE PLACE MEASURES THE RIGHT PANEL. It is two columns that fold
  // independently, so it has four widths, and four widths written out as four
  // CSS classes is three chances to get the fourth wrong. The panel's own
  // width and the render's inset are the same number and come from here.
  const PROPS_W = 390, PARTS_W = 250, SPINE = 46;
  function layoutRight() {
    const w = (propsOff ? SPINE : PROPS_W) + (collapsed ? SPINE : PARTS_W);
    wrap.style.width = w + 'px';
    if (typeof api.panelWidth === 'function') api.panelWidth(w);
  }
  function setCollapsed(on) {
    collapsed = !!on;
    pref(LS_COL, collapsed ? '1' : '0');
    wrap.classList.toggle('pcol-off', collapsed);
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
      rows: ['control cage', 'wireframe', 'section colours', 'curvature heat',
             'surface field', 'subsurf', 'template step', 'canopy loops',
             'glass α', 'fuselage α', 'int skin α', 'structure α', 'cowl α'] },
    // 'the light in the shed' is now the light EVERYWHERE: the world got a
    // switchboard of its own this chantier, and the two belong in one place
    // because the question a player actually asks — why does it look like that
    // out there and not in here? — is about the pair, not either one.
    { k: 'night', label: 'night', title: 'The light, in here and out there',
      icon: 'M14.2 11.1A5.8 5.8 0 0 1 6.9 3.8a5.8 5.8 0 1 0 7.3 7.3Z',
      rows: ['time of day', 'lights', 'world lights', 'ground bounce'],
      shed: true },
    { k: 'explode', label: 'explode', title: 'The build, taken apart',
      icon: 'M9 2.4v4.2|M9 11.4v4.2|M2.4 9h4.2|M11.4 9h4.2|M7.4 7.4h3.2v3.2H7.4z',
      rows: ['explode', 'cutaway'] },
    { k: 'measure', label: 'measure', title: 'What the build measures',
      icon: 'M2.6 6.4h12.8v5.2H2.6z|M5.4 6.4v2.2|M8.2 6.4v3|M11 6.4v2.2|M13.8 6.4v3',
      rows: ['dims box'] },
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
  }

  // the label -> row index, over everywhere a row _cage_ui built can be
  // sitting: the overflow section, the parking nursery, and the shed sheet
  // (the room's panel moves there whole, and the `night` flyout borrows two of
  // its rows back)
  function labelIndex() {
    const idx = new Map();
    for (const host of [$('cgUi'), nursery, $('shedBody')]) {
      if (!host) continue;
      for (const r of host.querySelectorAll('.r')) {
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
    head.textContent = t.title;
    if (t.k === 'camera') buildCamera(body);
    const idx = labelIndex();
    for (const label of (t.rows || [])) {
      const r = idx.get(label);
      if (r) borrow(r, body);
    }
    if (t.k === 'measure') {
      const m = $('dims');
      if (m) borrow(m, body);
    }
    // THE MESH COUNTS ARE A DIAGNOSTIC (G86). Five hundred characters of
    // vertices, quads and per-layer measurements were sitting at the foot of
    // the panel on every screen — the user's "big blob of text and numbers at
    // the bottom". It is not information about the AEROPLANE, it is
    // information about the BUILD, so it lives behind the display flyout with
    // the rest of how-you-look-at-it.
    if (t.k === 'display') {
      const st = $('edStat');
      if (st) borrow(st, body);
    }
    if (t.shed) {
      const a = document.createElement('button');
      a.className = 'pill wide';
      a.textContent = 'tune the shed ›';
      a.onclick = () => { openFly(null); openShed(true); };
      body.appendChild(a);
    }
  }

  // THE FRAMING PRESETS. The game's own orbit camera, driven through the
  // bridge — the bench's `setView` moves a camera the game does not use.
  function buildCamera(body) {
    const wrap2 = document.createElement('div');
    wrap2.className = 'edCam';
    for (const [label, key] of [['3/4 front', 'q'], ['side', 's'],
                                ['plan', 't'], ['nose', 'f'],
                                ['cockpit', 'i'], ['refit', 'r']]) {
      const b = document.createElement('button');
      b.className = 'pill';
      b.textContent = label;
      b.onclick = () => { if (api.camera) api.camera(key); };
      wrap2.appendChild(b);
    }
    body.appendChild(wrap2);
  }

  // ---- the shed's sheet, and the loan --------------------------------------
  // THE AEROPLANE'S SHEET IS GONE. Everything that was behind the name — the
  // plaque, the bench, the store — is the INFORMATION PANEL now, permanently,
  // because a plaque you have to open hides the consequence of the slider you
  // just moved. The SHED keeps a sheet: the room is a different subject and
  // wants width, and it becomes a tree branch in the chantier after this one.
  function sheetState() {
    document.body.classList.toggle('sheet-open', !$('edShed').hidden);
  }
  function openShed(on) {
    const s = $('edShed'), sc = $('edScrim');
    if (!s) return;
    s.hidden = !on;
    if (sc) sc.hidden = !on;
    sheetState();
    const body = $('shedBody');
    // the room's whole panel, moved bodily: it is one subject and it already
    // reads as one — the time of day and the light switches are borrowed back
    // by the `night` flyout while it is open, and returned when it closes.
    const hd = document.querySelector('#edWrap details[data-g="hangar"]') ||
               nursery.querySelector('details[data-g="hangar"]');
    if (on && body && hd && hd.parentElement !== body) {
      hd.open = true;
      body.appendChild(hd);
    }
  }
  // WHICH AEROPLANE IS ON THE STAND is a question about the fleet, so the
  // game's own select is MOVED into the fleet section rather than copied — a
  // copy would be a second control writing the same state. It goes home when
  // the workshop does, because the bottom bar is where the game expects it.
  let acHome = null, acNext = null;
  function borrowAircraftSelect() {
    const host = $('shAc'), sel2 = document.getElementById('selAc');
    if (!host || !sel2 || sel2.parentElement === host) return;
    acHome = sel2.parentElement; acNext = sel2.nextSibling;
    host.appendChild(sel2);
  }
  function releaseView() {
    const sel2 = document.getElementById('selAc');
    if (sel2 && acHome && sel2.parentElement !== acHome)
      acHome.insertBefore(sel2, acNext);
    openShed(false); openFly(null);
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
    [/^edWheelT|^edLegT|^edCastorT/, 'third'],
    [/^edWheel|^edLeg|^edCastor/, 'mains'],
    [/^edSpinner|^edProp/, 'prop'],
    [/^edFit_liftstrut/, 'struts'],
    [/^edFit_pitot/, 'wingPanel'],
    [/^edSurf_ail/, 'wingCtl'],
    [/^edSurf_rud/, 'fin'],
    [/^edSurf_elev/, 'stab'],
    // the crew layer names nothing it builds, but the DUMMIES are skeletons
    // and their bones are named — so the one split that can be made is the
    // people from the furniture. Seats, controls and the console have no names
    // at all and fall together on the layer's default part; that is the layer's
    // to fix, not this table's.
    [/^(root|lumbar|thorax|neck|head|clavicle|shoulder|elbow|wrist|hip|knee|ankle)/,
     'crew'],
  ];
  const layerDefault = key => {
    for (const p of PT.CAGE_PARTS)
      if (p.layer === key && p.parent && !p.root) return p.key;
    return null;
  };
  function partOfHit(hit) {
    if (!hit) return null;
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
  // THE DEFAULT IS NOT DECIDED HERE. It is stated in one place, persisted, and
  // reachable at runtime as `window.EDITOR_HILITE` so it can be flipped
  // without a rebuild and wired to a control by whoever owns the view panel.
  //
  // r128 FACT, so nobody spends an afternoon on it: `LineBasicMaterial.
  // linewidth` is IGNORED by every desktop WebGL driver — the core profile
  // only guarantees 1 px. A thicker outline needs fat-line geometry (two
  // triangles per segment), which is a different chantier; `width` below is
  // recorded as intent and does nothing yet.
  const HI_DEF = {
    mode: 'outline',        // 'outline' | 'fill' | 'both'
    line: 0x00e5ff,         // the selection outline: nothing on the aeroplane
    lineHov: 0x66f0ff,      // or in the shed is this colour, which is the point
    fill: 0xe6dbc9,         // what the wash was, kept for 'fill' and 'both'
    through: true,          // draw over the aeroplane, so a part behind the
                            // covering can still be seen to be selected
    angle: 24,              // EdgesGeometry threshold, degrees
    width: 1,               // intent only — see the r128 note above
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
  // the switch, live: no rebuild of the editor, just of the highlight
  window.EDITOR_HILITE = (o) => {
    if (!o) return Object.assign({}, HI);
    Object.assign(HI, o);
    try { localStorage.setItem(HI_PREF, JSON.stringify(HI)); } catch (e) {}
    hiMats = null;                      // colours live on the materials
    const sel = pinFor;
    hiClear('sel'); hiClear('hov');
    if (sel) hiBuild(sel, 'sel');
    return Object.assign({}, HI);
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

  function hiBuild(partKey, which) {
    hiClear(which);
    const root = window.CAGE_UI_SCENE;
    // HIGHLIGHTING THE WHOLE AEROPLANE IS NOT A HIGHLIGHT. The root selects
    // everything, and an overlay over everything is a tint over a tint — it
    // says nothing and costs a copy of every index in the build.
    if (!partKey || partKey === 'craft' || !root ||
        typeof THREE === 'undefined') return;
    if (!hiMats) hiMats = { sel: hiMat(0.34), hov: hiMat(0.16),
                            selL: hiLine('sel'), hovL: hiLine('hov') };
    const mat = hiMats[which];
    const wantFill = HI.mode !== 'outline', wantLine = HI.mode !== 'fill';
    const out = [];
    // every part shown under this key — selecting an assembly lights all of it
    const parts = partsShown(partKey).filter(exists);
    const want = new Set(), layers = new Set(), keys = new Set();
    for (const p of parts) {
      for (const s of (p.sections || [])) want.add(s);
      if (p.layer && p.layer !== 'cage') layers.add(p.layer);
      keys.add(p.key);
    }
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
        const runs = [];
        let n = 0;
        for (const g of src.groups)
          if (want.has(nm[g.materialIndex])) {
            runs.push(idx.array.subarray(g.start, g.start + g.count));
            n += g.count;
          }
        if (!n) continue;
        const keep = new idx.array.constructor(n);
        let at = 0;
        for (const r of runs) { keep.set(r, at); at += r.length; }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', src.getAttribute('position'));
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
        continue;
      }
      const ln = (child.name || '');
      if (ln.lastIndexOf('cageLayer:', 0) !== 0) continue;
      if (!layers.has(ln.slice(10))) continue;
      // A LAYER: its meshes, re-drawn as children of themselves so the whole
      // transform chain comes for free.
      const def = layerDefault(ln.slice(10));
      child.traverse(o => {
        if (!o.isMesh || (o.userData && o.userData.edHi)) return;
        if (!keys.has(ownerOf(o, child, def))) return;
        if (wantFill) {
          const m = new THREE.Mesh(o.geometry, mat);
          m.renderOrder = 6;
          m.userData.edHi = 1;
          o.add(m);
          out.push(m);
        }
        if (wantLine) { const l = hiEdges(o.geometry, which); o.add(l);
                        out.push(l); }
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
  // app.js hands a HIT down on click, and on hover while nothing is dragging
  let hovKey = null;
  window.EDITOR_PICK = (hit, hover) => {
    const key = partOfHit(hit);
    if (!hover) {
      if (key) select(key);
      return;
    }
    if (key === hovKey) return;
    hovKey = key;
    hiBuild(key === sel ? null : key, 'hov');
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
    wrap.classList.toggle('fin', view === 'finish');
    if (t1) t1.classList.toggle('on', view === 'shape');
    if (t2) t2.classList.toggle('on', view === 'finish');
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
    wrap.classList.toggle('pcol-off', collapsed);
    wrap.classList.toggle('prop-off', propsOff);
    layoutRight();
    // ---- the view layer -------------------------------------------------
    buildRail();
    for (const [id, fn] of [['shedClose', () => openShed(false)],
                            ['edScrim', () => openShed(false)]]) {
      const el = $(id); if (el) el.onclick = fn;
    }
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
    borrowAircraftSelect();
    // ESC closes whatever is over the view, innermost first
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (!$('edShed').hidden) openShed(false);
      else if (flyOpen) openFly(null);
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
    // RUN THE BENCH shows the bench pane and runs the declared list. Both are
    // bench.js's own controls; nothing here knows what a test is.
    const rb = $('edRunBench');
    if (rb) rb.onclick = () => {
      // no tab to switch to any more — the bench is a section of the
      // information panel and is already on screen. Scroll it into view and
      // press bench.js's own run-all; nothing here knows what a test is.
      const bt = $('bTests');
      if (bt && bt.scrollIntoView) bt.scrollIntoView({ block: 'nearest' });
      const all = $('bRunAll'); if (all && !all.disabled) all.click();
    };
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
  // app.js calls this when the editor leaves the screen (rolling out): the
  // game's aircraft select is on loan to the sheet and has to go home, and
  // nothing should be left floating over a view that is now the world.
  window.EDITOR_RELEASE = releaseView;
  // app.js calls this straight after CAGE_PAGE_SETUP, which is what injects
  // the derived selectors. It is a separate hook because that call is the
  // GAME's (openEditor makes it); the bench pages make it themselves and have
  // no editor panel to tell.
  window.CAGE_ON_PAGE = collectDerived;
}
