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
        LS_OPTS = 'flydiy.edOpts';
  const pref = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  };

  let sel = pref(LS_SEL) || 'craft';
  if (!PT.partByKey[sel]) sel = 'craft';
  let collapsed = pref(LS_COL) === '1';
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
  let treeSig = '';                        // only redraw when the tree changes

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
    // 2. the measurement pane is a fact about the build, not a parameter: it
    //    goes to the foot rather than into the inspector
    const dims = $('dims'), meas = $('edMeasure');
    if (dims && meas) meas.appendChild(dims);
    // 3. EVERY CLAIMED ROW LEAVES THE ACCORDION NOW, not when it happens to be
    //    selected. The inspector shows one part at a time; the rest have to be
    //    somewhere, and that somewhere cannot be the accordion, because the
    //    accordion is the EDITOR OPTIONS section — opening the editor on the
    //    cabin would otherwise leave the other five hundred rows sitting under
    //    `editor & shed` in their old groups, which is the screen this
    //    chantier exists to replace.
    for (const [k, ms] of rowsFor)
      if (PT.paramOwner[k]) for (const m of ms) nursery.appendChild(m.row);
    // 4. ...and the emptied accordion groups go with them. They are MOVED, not
    //    removed: _cage_page5.js's derived selectors are injected by
    //    `CAGE_PAGE_SETUP` after this runs and find their host by
    //    `details[data-g=...]`, so the host has to still be in the document.
    //    See collectDerived.
    const ui = $('cgUi');
    if (ui) for (const det of Array.from(ui.children)) {
      if (det.tagName !== 'DETAILS') continue;
      if (!det.querySelector('.r')) nursery.appendChild(det);
    }
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
      if (el.classList.contains('r')) nursery.appendChild(el);
      else el.remove();
    }
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
    const cEl = $('edChanged');
    if (cEl) cEl.textContent = changedHere ? changedHere + ' changed' : '';
    paintTree();
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
    const walk = (parent, lvl) => {
      for (const p of PT.CAGE_PARTS) {
        if (p.root || p.parent !== parent) continue;
        if (!exists(p)) continue;
        rows.push({ p, lvl, name: nameOf(p) });
        walk(p.key, lvl + 1);
      }
    };
    walk(null, 0);
    // THE SELECTION FOLLOWS THE AEROPLANE. Turn the mirrored pod off while the
    // aft deck is selected and that part stops existing — the tree drops it and
    // the inspector would go on heading a column of nothing. Fall back up the
    // parents until something that is still on the aeroplane.
    if (!rows.some(r => r.p.key === sel) && sel !== 'craft') {
      let up = PT.partByKey[sel];
      while (up && up.parent && !rows.some(r => r.p.key === up.key))
        up = PT.partByKey[up.parent];
      select(up && rows.some(r => r.p.key === up.key) ? up.key : 'craft');
      return;
    }
    const badges = rows.map(r => partBadge(r.p));
    const sig = rows.map((r, i) => r.p.key + r.lvl + r.name + badges[i]).join('|')
      + '#' + sel;
    if (sig === treeSig) return;
    treeSig = sig;
    treeEl.textContent = '';
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'edN lv' + Math.min(2, r.lvl) +
        (r.p.key === sel ? ' on' : '');
      d.tabIndex = 0;
      d.dataset.p = r.p.key;
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
    if (!PT.partByKey[key]) return;
    sel = key;
    pref(LS_SEL, key);
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

  function setCollapsed(on) {
    collapsed = !!on;
    pref(LS_COL, collapsed ? '1' : '0');
    wrap.classList.toggle('pcol-off', collapsed);
    if (typeof api.panelWidth === 'function') api.panelWidth(collapsed ? 436 : 640);
  }

  // =========================================================================
  // WIRING
  // =========================================================================
  {
    const rp = $('edResetPart'); if (rp) rp.onclick = resetPart;
    const ex = $('edExpert');
    if (ex) ex.onclick = () => setExpert(!(CU && CU.EXPERT && CU.EXPERT.on));
    const c1 = $('edCollapse'); if (c1) c1.onclick = () => setCollapsed(true);
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
    select(sel);
  };
  window.CAGE_ON_VIS = applyVis;
  // app.js calls this straight after CAGE_PAGE_SETUP, which is what injects
  // the derived selectors. It is a separate hook because that call is the
  // GAME's (openEditor makes it); the bench pages make it themselves and have
  // no editor panel to tell.
  window.CAGE_ON_PAGE = collectDerived;
}
