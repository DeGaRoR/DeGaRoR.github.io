// ui/atlas/bar.js — the Atlas's sticky header, and the facet sheet behind it.
//
// One search field, four controls, a row of active-filter chips, and a line that
// says what the list is currently showing. Everything it offers comes out of the
// FACETS and COLUMNS tables in ui/atlas/derive.js — the bar declares no
// vocabulary of its own, which is what stops it drifting away from the evaluator.
//
// ── THE COUNT LINE IS NOT DECORATION ─────────────────────────────────────────
//
// "128 of 312 · 41 unmeasured" is the only thing on the page that can tell you
// the list is incomplete, and there are two different ways it can be. A filter
// hiding things is the player's own doing and reversible. An unmeasured record
// is the Atlas admitting it does not know a number it is being asked to sort on
// — and the alternative to admitting it is to sort those creatures as if they
// had scored zero, which would be the page inventing a measurement.
//
// Tokens only, no hex/px (N16).

import { t } from '../../trunk/i18n.js';
import { mk, button } from '../widgets.js';
import { openMenu } from '../menu.js';
import { FACETS, FACET_BY_ID, COLUMNS, COLUMN_BY_ID } from './derive.js';
import * as query from './query.js';

/**
 * Build the bar.
 *
 * @param {object} o
 * @param {() => void} o.onChange   the query moved; re-render the list
 * @param {() => object} o.result   the latest `applyQuery` result, for counts
 * @param {() => Array} o.rows      every row, for the facet value lists
 * @param {() => void} [o.onSelectMode]
 * @param {() => void} [o.onMeasureAll]
 * @returns {{el:HTMLElement, sync:Function}}
 */
export function filterBar(o) {
  const el = mk('atlas-bar');

  // ── search ────────────────────────────────────────────────────────────────
  const searchRow = mk('atlas-search', el);
  const input = mk('field atlas-q', searchRow, 'input');
  input.type = 'search';
  input.placeholder = t('Search names, families, colours…');
  input.setAttribute('aria-label', t('Search the Atlas'));
  input.value = query.current().q;

  // DEBOUNCED, because every keystroke re-filters, re-counts and rebuilds the
  // list. At three hundred rows that is fast enough to do per keystroke and
  // still wasteful enough to be worth not doing.
  let typing = 0;
  input.addEventListener('input', () => {
    clearTimeout(typing);
    typing = setTimeout(() => { query.set({ q: input.value }); o.onChange(); }, 120);
  });

  // ── controls ──────────────────────────────────────────────────────────────
  const controls = mk('atlas-controls', el);

  const chip = (label, onClick, cls = '') => {
    const b = mk(cls ? `atlas-chip ${cls}` : 'atlas-chip', controls, 'button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const btnFilter = chip(t('Filter'), () => openFacetSheet(el, o));
  const btnSort = chip('', () => openMenu(btnSort, [
    ...COLUMNS.map((c) => ({
      label: c.label,
      on: query.current().sort.col === c.id,
      onSelect: () => { query.set({ sort: { col: c.id, dir: c.dir } }); o.onChange(); },
    })),
    {
      label: t('Reverse'),
      on: isReversed(),
      onSelect: () => {
        const s = query.current().sort;
        query.set({ sort: { ...s, dir: -s.dir } });
        o.onChange();
      },
    },
  ]));
  btnSort.setAttribute('aria-haspopup', 'menu');

  const btnGroup = chip('', () => openMenu(btnGroup, [
    {
      label: t('No grouping'), on: !query.current().group,
      onSelect: () => { query.set({ group: null }); o.onChange(); },
    },
    // Only facets that would actually split THIS corpus into more than one pile.
    // Offering "group by shelf" when every record is a player's own produces one
    // heading over the whole list, which reads as a bug.
    ...FACETS.filter((f) => f.values(o.rows()).length > 1).map((f) => ({
      label: f.label,
      on: query.current().group === f.id,
      onSelect: () => { query.set({ group: f.id }); o.onChange(); },
    })),
  ]));
  btnGroup.setAttribute('aria-haspopup', 'menu');

  const btnView = chip('', () => {
    query.set({ view: query.current().view === 'grid' ? 'list' : 'grid' });
    o.onChange();
  }, 'atlas-view');

  if (o.onSelectMode) chip(t('Select'), o.onSelectMode);

  // `⋯` AND NOT `☰`. The density toggle beside it already uses `☰` to mean
  // "list", and two identical glyphs in one control row is a row you have to
  // tap to read.
  const btnMore = chip('⋯', () => openMenu(btnMore, [
    ...(o.onMeasureAll && (o.result()?.unmeasured ?? 0) > 0 ? [{
      label: `${t('Measure')} ${o.result().unmeasured} ${t('unmeasured')}`,
      onSelect: o.onMeasureAll,
    }] : []),
    {
      label: t('Clear filters'),
      onSelect: () => { query.clearAll(); input.value = ''; o.onChange(); },
    },
  ]));
  btnMore.setAttribute('aria-haspopup', 'menu');
  btnMore.setAttribute('aria-label', t('More'));

  // ── the active-filter chips ───────────────────────────────────────────────
  //
  // EVERY ACTIVE CONSTRAINT IS VISIBLE AND EVERY ONE IS ONE TAP TO REMOVE. A
  // filter you cannot see is a filter you will eventually blame the data for.
  const chips = mk('atlas-chips', el);

  const countLine = mk('atlas-count', el);

  function isReversed() {
    const s = query.current().sort;
    return s.dir !== (COLUMN_BY_ID.get(s.col)?.dir ?? -1);
  }

  function sync() {
    const q = query.current();
    const res = o.result();

    btnSort.textContent = `${COLUMN_BY_ID.get(q.sort.col)?.label ?? t('Sort')}${isReversed() ? ' ↑' : ''}`;
    btnGroup.textContent = q.group ? FACET_BY_ID.get(q.group).label : t('Group');
    btnGroup.dataset.on = q.group ? 'yes' : 'no';
    btnView.textContent = q.view === 'grid' ? '☰' : '⊞';
    btnView.setAttribute('aria-label', q.view === 'grid' ? t('List view') : t('Grid view'));

    const active = Object.entries(q.facets).filter(([, v]) => v?.length);
    btnFilter.dataset.on = active.length ? 'yes' : 'no';
    btnFilter.textContent = active.length
      ? `${t('Filter')} · ${active.reduce((n, [, v]) => n + v.length, 0)}`
      : t('Filter');

    chips.replaceChildren();
    chips.hidden = !active.length;
    for (const [id, values] of active) {
      const f = FACET_BY_ID.get(id);
      for (const v of values) {
        const c = mk('atlas-chip active', chips, 'button');
        c.type = 'button';
        c.textContent = `${f.labelOf(v)} ✕`;
        c.setAttribute('aria-label', `${t('Remove filter')} ${f.labelOf(v)}`);
        c.addEventListener('click', () => { query.toggleFacet(id, v); o.onChange(); });
      }
      if (values.length > 1) {
        const c = mk('atlas-chip', chips, 'button');
        c.type = 'button';
        c.textContent = t('clear');
        c.addEventListener('click', () => { query.clearFacet(id); o.onChange(); });
      }
    }

    const parts = [];
    parts.push(res.matched === res.total
      ? `${res.total} ${res.total === 1 ? t('creature') : t('creatures')}`
      : `${res.matched} ${t('of')} ${res.total}`);
    if (q.group) parts.push(`${t('grouped by')} ${FACET_BY_ID.get(q.group).label.toLowerCase()}`);
    // ONLY WHEN SORTING ON A MEASURED COLUMN. An unmeasured count beside a sort
    // by name is noise; beside a sort by food it is the reason some cards are at
    // the bottom, and without it that looks like a ranking rather than a gap.
    if (res.unmeasured && COLUMN_BY_ID.get(q.sort.col)?.measured) {
      parts.push(`${res.unmeasured} ${t('unmeasured')}`);
    }
    countLine.textContent = parts.join(' · ');
  }

  return { el, sync };
}

/**
 * The facet sheet — one section per facet, chips carrying live counts.
 *
 * A SHEET AND NOT A MENU because there are eleven facets and each has up to
 * twenty-four values; `openMenu` is one column of items with no sections, and
 * three hundred menu items is not a menu.
 *
 * COUNTS ARE ON EVERY CHIP, and they lift their own facet's constraint (see
 * applyQuery). That makes a chip mean "this many more if you also pick this",
 * which is the question, rather than "this many after you already picked it",
 * which answers itself.
 */
function openFacetSheet(bar, o) {
  const back = mk('atlas-sheet-back', document.body);
  const sheet = mk('atlas-sheet', back);
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', t('Filter the Atlas'));

  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });

  const body = mk('atlas-sheet-body', sheet);

  function paint() {
    body.replaceChildren();
    const rows = o.rows();
    const counts = o.result().counts;
    let any = false;

    for (const f of FACETS) {
      const values = f.values(rows);
      // A facet with one value cannot narrow anything — every creature would
      // match it — so it is not offered. This is what keeps the sheet short on a
      // small Atlas and lets it grow honestly as the collection does.
      if (values.length < 2) continue;
      any = true;
      const sec = mk('atlas-facet', body);
      mk('atlas-facet-h', sec).textContent = f.label;
      const list = mk('atlas-facet-values', sec);
      const chosen = query.current().facets[f.id] ?? [];
      for (const v of values) {
        const n = counts[f.id]?.[v] ?? 0;
        const c = mk('atlas-chip', list, 'button');
        c.type = 'button';
        c.dataset.on = chosen.includes(v) ? 'yes' : 'no';
        // A zero-count chip stays VISIBLE and goes dim rather than vanishing:
        // a sheet whose contents rearrange as you tap is a sheet you cannot
        // learn the shape of.
        if (!n && !chosen.includes(v)) c.dataset.empty = 'yes';
        mk('atlas-chip-l', c, 'span').textContent = f.labelOf(v);
        mk('atlas-chip-n', c, 'span').textContent = `${n}`;
        c.addEventListener('click', () => {
          query.toggleFacet(f.id, v);
          o.onChange();
          paint();
        });
      }
    }

    if (!any) {
      mk('spec-empty', body, 'p').textContent =
        t('Nothing to filter on yet — every creature here is the same on every axis. Breed a few more.');
    }
  }
  paint();

  const foot = mk('atlas-sheet-foot', sheet);
  foot.append(
    button(t('Clear all'), () => { query.clearAll(); o.onChange(); paint(); }),
    button(t('Done'), close),
  );
}
