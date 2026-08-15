// ui/screens/atlas.js — the collection.
//
// ── WHAT CHANGED, AND WHY IT HAD TO ──────────────────────────────────────────
//
// This screen used to be `store.list('specimen:')` plus one `store.get` per key,
// on every mount, feeding a flat newest-first grid. Every record carries its
// 1024 px portrait inline, so that loop deserialised the whole library before a
// single card existed, and `nav.render()` remounts on every tab switch.
//
// It reads ui/atlas/index.js now. Rows are primitives, portraits arrive when a
// card is scrolled near, and the two background passes below work off rows
// instead of re-reading the store to find out what needs doing.
//
// Tokens only, no hex/px (N16).

import { t } from '../../trunk/i18n.js';
import { seedAtlas } from '../../worlds/atlas_seed.js';
import { renderThumbnail, RENDER_TAG } from '../../render/thumbnail.js';
import { specCard, cardStat } from '../cards.js';
import { button, mk } from '../widgets.js';
import { nameFor } from '../vernacular.js';
import { lineageFrom } from '../../engine/l1/vernacular.js';
// How many creatures a tank holds, and therefore how many may be ticked. Read
// from the engine rather than restated, so the cap cannot drift from the tank.
import { POPULATION } from '../../engine/l1/breed.js';
import * as names from '../names.js';
import * as atlas from '../atlas/index.js';
import { sampleFromRow } from '../atlas/derive.js';
import { reveal } from '../atlas/reveal.js';
import { specRow } from '../atlas/list.js';
import { filterBar } from '../atlas/bar.js';
import * as query from '../atlas/query.js';
import { applyQuery } from '../atlas/query.js';
import { measureGenome } from '../atlas/measure.js';
import * as release from '../release.js';
import * as nav from '../../trunk/nav.js';

export default {
  title: t('Atlas'),
  mount(el) {
    let stopped = false;
    /** One `reveal()` handle per rendered group, torn down on every re-render. */
    let live = [];
    let result = { groups: [], total: 0, matched: 0, counts: {}, unmeasured: 0 };

    // ══ SELECTION ════════════════════════════════════════════════════════════
    //
    // ONE MECHANISM, TWO WAYS IN. The Vivarium's `Atlas` control calls
    // `release.requestStock(POPULATION)` and switches tabs, so the screen can
    // OPEN as a picker; and a press-and-hold on any card starts a selection from
    // inside, the way a photo library does. Both land in the same state, so the
    // verb, the cap, the counter and the bar are written once.
    //
    // It is the same grid either way — same search, same filters, same sort —
    // which is the entire reason the tank stopped carrying a picker of its own.
    //
    // THE CAP IS THE TANK'S, NOT THE SELECTION'S: `POPULATION` creatures fit,
    // so that is what may be ticked. A card refuses the toggle rather than
    // accepting it and being quietly dropped at release.
    const requested = release.stocking();
    /** null when browsing; `{ capacity, fromTank }` while selecting. */
    let selecting = requested ? { capacity: requested.capacity, fromTank: true } : null;
    const chosen = new Set();

    const wrap = mk('atlas', el);
    const bar = filterBar({
      onChange: () => render(),
      result: () => result,
      rows: () => atlas.rows(),
      onMeasureAll: () => measureRecords(measurable(), Infinity),
      onSelectMode: () => beginSelect(),
    });
    wrap.append(bar.el);
    const body = mk('atlas-body', wrap);

    // Fixed above the tab bar, so the count and the verb stay put however far
    // down the list you have scrolled — choosing six creatures out of three
    // hundred is a lot of scrolling.
    const selbar = mk('atlas-selbar', wrap);
    selbar.hidden = true;
    const selCount = mk('atlas-selbar-n', selbar, 'span');
    const selGo = button('', doRelease);
    // THE VERB IS BIGGER THAN THE ESCAPE HATCH. Releasing is what the bar is
    // for; cancelling is what you do when you opened it by accident. Sizing them
    // equally made the bar read as a question with two answers.
    selGo.className = 'btn atlas-selbar-go';
    // ── DELETE, FOR THE SELECTION ────────────────────────────────────────────
    //
    // AUTHORED SPECIMENS ARE NOT DELETABLE and the button says so by leaving:
    // `seedAtlas` replants the shipped library on the next open, so deleting one
    // is a button that appears to work and then undoes itself. It is offered only
    // when every ticked creature is the player's own.
    const selDel = button('', async () => {
      selDel.disabled = true;
      for (const key of chosen) { await atlas.remove(key); names.forget(key); }
      chosen.clear();
      selecting = null;
      render();
    });
    selDel.className = 'btn atlas-selbar-del';
    const selCancel = button(t('Cancel'), endSelect);
    selCancel.className = 'btn atlas-selbar-cancel';
    selbar.append(selGo, selDel, selCancel);

    /** Enter selection mode, optionally with the card that was held. */
    function beginSelect(row) {
      if (!selecting) selecting = { capacity: POPULATION, fromTank: false };
      if (row && chosen.size < selecting.capacity) chosen.add(row.key);
      render();
    }

    /**
     * Leave it. A selection started from the TANK returns there — the player
     * was sent here mid-task and cancelling means "never mind, take me back" —
     * whereas one started by holding a card just goes back to browsing, which is
     * where they already were.
     */
    function endSelect() {
      const fromTank = selecting?.fromTank;
      selecting = null;
      chosen.clear();
      release.cancel();
      if (fromTank) { nav.goTab('vivarium'); return; }
      render();
    }

    async function doRelease() {
      if (!chosen.size) return;
      selGo.disabled = true;
      const picks = [];
      // Rows carry no genome — that is what makes them small — so the records
      // are read here, for the chosen few only.
      for (const key of chosen) {
        const spec = await atlas.specFor(key);
        if (spec?.genome) picks.push(spec);
      }
      // `release()` caps at the outstanding request's capacity when there is one
      // and at what it is given otherwise, so a selection begun from a long-press
      // needs no separate ceiling.
      await release.release(picks);
      nav.goTab('vivarium');
    }

    function syncSel() {
      wrap.dataset.selecting = selecting ? 'yes' : 'no';
      selbar.hidden = !selecting;
      if (!selecting) return;
      selCount.textContent = `${chosen.size}/${selecting.capacity}`;
      selGo.textContent = chosen.size === 1
        ? t('Put 1 in the vivarium')
        : `${t('Put')} ${chosen.size} ${t('in the vivarium')}`;
      selGo.disabled = chosen.size === 0;

      const deletable = chosen.size > 0
        && [...chosen].every((k) => atlas.rowFor(k)?.source !== 'authored');
      selDel.hidden = !deletable;
      selDel.textContent = `${t('Delete')} ${chosen.size}`;
      selDel.disabled = false;
    }

    async function boot() {
      // Plant the authored library on first open (idempotent, keyed by hash), so
      // a fresh Atlas is the shipped creatures rather than an empty page. A
      // failure here must never blank the screen.
      try { await seedAtlas(); } catch { /* the library just won't appear */ }
      if (stopped) return;
      // The names index, and then the row index. Order matters: `deriveRow`
      // precomputes each card's display name through `names.label`, so an index
      // built before the names were loaded would bake in binomials.
      await names.load();
      if (stopped) return;
      await query.restore();
      if (stopped) return;
      await atlas.ensureIndex({ cancelled: () => stopped });
      if (stopped) return;
      render();
      // ONLY WHAT IS ON SCREEN, and only after the page exists. See
      // `measureRecords` for why this is a budget and not a sweep.
      measureRecords(measurable(), MEASURE_BUDGET);
      upgradeRecords(atlas.rows());
    }

    /** The rows the player can currently see, unmeasured, in list order. */
    function measurable() {
      return result.groups.flatMap((g) => g.rows).filter((r) => r.profileState === 'none');
    }

    function render() {
      const q = query.current();
      result = applyQuery(atlas.rows(), q);

      for (const l of live) l.stop();
      live = [];
      body.replaceChildren();
      bar.sync();
      syncSel();

      if (!result.total) {
        mk('spec-empty-page', body, 'p').textContent =
          t('No saved creatures yet. In the Tank, long-press a creature and tap Save to keep it here.');
        return;
      }
      if (!result.matched) {
        // A DIFFERENT EMPTY STATE, because it has a different cause and a
        // different remedy. "You have none" and "none match what you asked for"
        // look identical on screen and are not the same fact.
        const p = mk('spec-empty-page', body, 'p');
        p.textContent = t('Nothing matches those filters.');
        p.append(button(t('Clear filters'), () => { query.clearAll(); render(); }));
        return;
      }

      for (const g of result.groups) {
        if (g.label != null) {
          const h = mk('atlas-group-head', body);
          h.textContent = `${g.label} · ${g.rows.length}`;
        }
        const host = mk(q.view === 'grid' ? 'spec-grid' : 'spec-list', body);
        live.push(reveal(host, g.rows, (r) => buildOne(r, q), { scroller: el }));
      }
    }

    function buildOne(r, q) {
      // PRESS AND HOLD IS AVAILABLE IN BOTH MODES. Out of selection it starts
      // one on the card you held; inside it, the tap already toggles, so the
      // hold costs nothing and the gesture never has to be un-learned.
      const common = {
        thumb: atlas.thumbFor,
        onLongPress: (row) => beginSelect(row),
        // TAP OPENS, HOLD SELECTS. The two gestures the grid understands, and
        // the same pair a photo library uses — which is the point of picking
        // that idiom rather than inventing one.
        onOpen: (row) => nav.push('specimen', { id: row.hash }),
      };

      if (selecting) {
        // The CALLER decides whether a toggle takes — the capacity is real, and a
        // card that ticked itself and was then refused would be lying about what
        // happened.
        const sel = {
          ...common, selectable: true, selected: chosen.has(r.key),
          onToggle: (next) => {
            if (next && chosen.size >= selecting.capacity) return false;
            if (next) chosen.add(r.key); else chosen.delete(r.key);
            syncSel();
            return true;
          },
        };
        // ── THE SAME CARD, TICKED ──────────────────────────────────────────
        //
        // `stats: false` used to be passed here, inherited from the old import
        // sheet where the grid was squeezed into 48vh and the numbers were cut
        // for room. On a full page it just meant every card silently lost a line
        // and got shorter the instant you started selecting — the grid reflowed
        // under your thumb, which is the one thing a selection must not do. A
        // tick is a state, not a different card.
        return q.view === 'list'
          ? specRow(r, { ...sel, sortCol: q.sort.col })
          : specCard(r, sel);
      }

      // ── DELETE IS NOT ON THE CARD ANY MORE ────────────────────────────────
      //
      // It used to be a full-width button under every thumbnail. At two columns
      // that was tolerable; at 109 px a card it is a tap target as tall as a
      // third of the animal, on every card, for an action taken rarely — and it
      // was the single biggest contributor to a card being 246 px tall with
      // 116 px of picture in it.
      //
      // It lives in the selection bar now: hold a card, tick what you want gone,
      // delete them together. That is both less chrome and a better fit for what
      // deleting actually is — you prune several at once, not one at a time.
      if (q.view === 'list') return specRow(r, { ...common, sortCol: q.sort.col });
      return specCard(r, common);
    }

    /**
     * ── PORTRAIT AND NAME BACKFILL ────────────────────────────────────────────
     *
     * THE MISSING HALF OF `RENDER_TAG`. The tag has been stamped onto every
     * specimen since it existed and NOTHING EVER COMPARED IT except `seedAtlas`,
     * and only for authored records. So a player's own creatures kept the
     * portrait they were saved with forever, and the day the render look changed
     * their Atlas became a mix of two looks with no way to reconcile it.
     *
     * The vernacular rides along because it is the same problem one step later: a
     * record saved before 14 existed has no common name and nothing else would
     * ever give it one.
     *
     * ── AND THIS IS THE ONE PLACE LINEAGE-RELATIVE NAMING STILL RUNS ──────────
     *
     * Everywhere else now mints from the global prior, because a name that
     * shifted as its neighbours changed was the whole reported bug (ui/names.js).
     * Here it is correct: the name is about to be WRITTEN INTO THE RECORD and
     * frozen, which is exactly the moment 14 §4 is describing. Names already in
     * the Atlas are `taken`, so §7's suppression applies and the backfill does
     * not manufacture duplicates.
     *
     * THE LINEAGE IS BUILT FROM ROWS. It used to run `morphogenesis` over every
     * stored specimen; `sampleFromRow` carries the three fields `lineageFrom`
     * actually folds, so it is now a map over primitives.
     */
    async function upgradeRecords(rows) {
      const stale = rows.filter((r) => r.render !== RENDER_TAG || !r.hasVernacular);
      if (!stale.length) return;

      const ctx = {
        lineage: lineageFromRows(rows),
        taken: new Set(rows.map((r) => r.name).filter(Boolean)),
      };

      let renamed = 0;
      for (const r of stale) {
        if (stopped) return;
        await yieldFrame();
        if (stopped) return;
        try {
          const spec = await atlas.specFor(r.key);
          if (!spec?.genome) continue;
          const patch = {};
          if (r.render !== RENDER_TAG) {
            patch.thumb = renderThumbnail(spec.genome, { worldId: spec.worldId ?? 'w1' });
            patch.render = RENDER_TAG;
          }
          if (!r.hasVernacular) {
            const v = nameFor(spec.genome, ctx, spec.worldId ?? 'w1');
            patch.vernacular = v.name;
            ctx.taken.add(v.name);
            renamed++;
          }
          const next = await atlas.patch(r.key, patch);
          if (stopped || !next) continue;
          names.remember(r.key, { ...spec, ...patch });
          // Swap the portrait in place rather than rebuilding the card, which
          // would drop everything else the two passes have painted into it.
          const img = body.querySelector(
            `[data-key="${cssEscape(r.key)}"] .spec-card-thumb, [data-key="${cssEscape(r.key)}"] .spec-row-thumb`);
          if (img && patch.thumb) img.src = patch.thumb;
        } catch { /* keep the old record; the next open tries again */ }
      }
      // A backfilled name changes what a card says, and the cards were built
      // before the names existed. One redraw at the end.
      if (renamed && !stopped) render();
    }

    /**
     * ── THE CARD MEASUREMENTS, RUN LAZILY AND CACHED ──────────────────────────
     *
     * A `forageProfile` is a 180 s simulation — 30 s of discarded warm-up and a
     * 150 s measurement window — plus an S3 turn probe, which is two more 8 s
     * runs. At forty specimens that was already a background grind; at three
     * hundred it is roughly fifteen hours of simulation, which is not a thing a
     * screen may start on its own.
     *
     * SO IT IS BOUNDED AS WELL AS DEFERRED. Only the first `MEASURE_BUDGET`
     * unmeasured rows are taken per visit, one at a time, yielding a frame
     * between each, replacing their "measuring…" labels in place as they arrive.
     * The rest wait for a deliberate act — the specimen page's Measure button,
     * or the overflow's "measure everything" — rather than being ground through
     * silently while the player is trying to read the page.
     *
     * CACHED INTO THE RECORD, keyed by `PROFILE_TAG` (ui/atlas/profile.js). The
     * measurement depends on the physics, the food model and the window, so a
     * stored profile from before any of those moved is not a measurement of this
     * build — the same staleness problem `RENDER_TAG` solves for portraits.
     *
     * `intact` IS CHECKED BEFORE THE NUMBERS ARE KEPT. ROADMAP §5b lesson 3: a
     * creature that comes apart reports fictional intake — 7864 g against rivals'
     * 31-49. A card showing that would be worse than a card showing nothing.
     */
    const MEASURE_BUDGET = 6;
    let measuring = false;

    async function measureRecords(rows, budget) {
      // ONE AT A TIME, EVER. Two of these running concurrently would interleave
      // Rapier worlds on the same thread and double the stall for no gain.
      if (measuring) return;
      const todo = rows.slice(0, budget);
      if (!todo.length) return;
      measuring = true;
      try { await runMeasure(todo); } finally { measuring = false; }
    }

    async function runMeasure(todo) {
      for (const r of todo) {
        if (stopped) return;
        await yieldFrame();
        if (stopped) return;

        const spec = await atlas.specFor(r.key);
        if (stopped || !spec?.genome) continue;

        // ONE IMPLEMENTATION, in ui/atlas/measure.js. The specimen page's
        // `Measure now` calls the same function, so the two cannot write
        // different numbers under the same PROFILE_TAG.
        const profile = await measureGenome(spec.genome);
        if (stopped) return;

        const next = await atlas.patch(r.key, { profile });
        if (!next) continue;
        // Swap the strip in place. Rebuilding the card would drop the portrait
        // that may have just finished loading into it.
        const dl = body.querySelector(`[data-key="${cssEscape(r.key)}"] .spec-card-metrics`);
        if (dl) dl.replaceChildren(...cardStat(next));
        // The count line owns the "N unmeasured" claim, and it has just changed.
        result.unmeasured = Math.max(0, result.unmeasured - 1);
        bar.sync();
      }
    }

    boot();

    return {
      stop() {
        stopped = true;
        for (const l of live) l.stop();
        // Leaving without releasing ends the request. Without this the Atlas
        // would still be a picker the next time it was opened, from a tank that
        // had long since stopped waiting.
        release.cancel();
      },
    };
  },

  // ── THE HALF OF `stop()` THAT WAS NEVER WIRED ────────────────────────────
  //
  // `mount` has returned a `stop()` since this screen existed and NOTHING EVER
  // CALLED IT: nav.js only invokes `def.unmount` (trunk/nav.js:118), and this
  // export did not have one. `vivarium.js` does. So `stopped` stayed false
  // forever and `measureRecords` — a 180 s headless simulation PER SPECIMEN —
  // kept running after the tab was left, writing into a detached grid and
  // holding every 1024 px portrait alive with it.
  //
  // One line, and it is the line every performance number here depends on.
  unmount(instance) { instance?.stop?.(); },
};

// ── helpers ─────────────────────────────────────────────────────────────────

/** `CSS.escape` where it exists; a store key is `specimen:<hex>` so this suffices. */
const cssEscape = (s) => (window.CSS?.escape ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));

/**
 * rAF DOES NOT FIRE ON A HIDDEN PAGE, so a bare `await rAF` wedges these loops
 * the moment the player switches browser tabs — and the Atlas would then sit on
 * a half-upgraded grid with no way to notice. The setTimeout is the fallback
 * that keeps them advancing; rAF still wins when visible, so a portrait is never
 * rendered in the middle of a paint. runBurst uses the same race for the same
 * reason.
 */
const yieldFrame = () => new Promise((r) => {
  let fired = false;
  const go = () => { if (!fired) { fired = true; r(); } };
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

/**
 * The lineage the backfill scores against, built from ROWS.
 *
 * `lineageFrom` folds exactly three things out of each sample — the slot words,
 * the binomial's `channel` and `extremity`, and the body radius — and a row
 * carries all three (ui/atlas/derive.js `sampleFromRow`). Building this used to
 * mean `morphogenesis` plus `slotsOf` over every stored specimen, every time.
 */
function lineageFromRows(rows) {
  return lineageFrom(rows.map(sampleFromRow));
}
