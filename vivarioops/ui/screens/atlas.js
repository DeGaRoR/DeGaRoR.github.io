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
import { specCard, metricRows } from '../cards.js';
import { button, mk } from '../widgets.js';
import { nameFor } from '../vernacular.js';
import { lineageFrom } from '../../engine/l1/vernacular.js';
import * as names from '../names.js';
import * as atlas from '../atlas/index.js';
import { sampleFromRow } from '../atlas/derive.js';
import { reveal } from '../atlas/reveal.js';
import { specRow } from '../atlas/list.js';
import { filterBar } from '../atlas/bar.js';
import * as query from '../atlas/query.js';
import { applyQuery } from '../atlas/query.js';
import { PROFILE_TAG } from '../atlas/profile.js';
import W1_SLICE from '../../worlds/w1_slice.js';

export default {
  title: t('Atlas'),
  mount(el) {
    let stopped = false;
    /** One `reveal()` handle per rendered group, torn down on every re-render. */
    let live = [];
    let result = { groups: [], total: 0, matched: 0, counts: {}, unmeasured: 0 };

    const wrap = mk('atlas', el);
    const bar = filterBar({
      onChange: () => render(),
      result: () => result,
      rows: () => atlas.rows(),
      onMeasureAll: () => measureRecords(measurable(), Infinity),
    });
    wrap.append(bar.el);
    const body = mk('atlas-body', wrap);

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
      const common = { thumb: atlas.thumbFor, onOpen: null };
      if (q.view === 'list') return specRow(r, { ...common, sortCol: q.sort.col });
      return specCard(r, {
        ...common,
        // Authored specimens are the shipped library and are not deletable — the
        // next open would only plant them again, so a Delete button would be a
        // button that does nothing.
        action: r.source === 'authored' ? null : button(t('Delete'), async (e) => {
          e.currentTarget.disabled = true;
          await atlas.remove(r.key);
          names.forget(r.key);
          render();
        }),
        // `el` IS `#screen`, and `#screen` is the scroller — base.css:28 gives it
        // `overflow-y: auto`. Passing `null` to reveal would listen for scroll on
        // `window`, which never fires, so the list would render its first chunk
        // and then silently stop growing and stop loading portraits.
      });
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
      const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
      await RAPIER.init();
      const [{ assessViability }, { forageProfile }, { S3 }] = await Promise.all([
        import('../../engine/l1/viability.js'),
        import('../../engine/l2/forage.js'),
        import('../../engine/l2/probes.js'),
      ]);
      if (stopped) return;

      for (const r of todo) {
        if (stopped) return;
        await yieldFrame();
        if (stopped) return;

        const spec = await atlas.specFor(r.key);
        if (stopped) return;
        if (!spec?.genome) continue;

        let profile = { tag: PROFILE_TAG, valid: false };
        try {
          const v = assessViability(RAPIER, spec.genome, W1_SLICE);
          if (v.ok) {
            const p = forageProfile(RAPIER, {
              plan: v.plan, genome: spec.genome, world: W1_SLICE, foodOpts: { seed: 11 },
            });
            if (p.valid && p.intact) {
              let turn = null;
              try {
                const s3 = S3(RAPIER, {
                  plan: v.plan, genome: spec.genome, world: W1_SLICE,
                  cruiseSpeed: p.netDisplacement / p.window,
                });
                if (s3.valid) turn = s3.turnRate3d * s3.steeringAuthority * (180 / Math.PI);
              } catch { /* a card without a turn figure, not a card that failed */ }
              profile = {
                tag: PROFILE_TAG, valid: true,
                foodPerSecond: p.foodPerSecond,
                multiplier: p.multiplier,
                straightness: p.straightness,
                size: p.size,
                turnCapability: turn,
              };
            }
          }
        } catch { /* leave it invalid; the next open tries again */ }

        const next = await atlas.patch(r.key, { profile });
        if (stopped || !next) continue;
        // Swap the strip in place. Rebuilding the card would drop the portrait
        // that may have just finished loading into it.
        const dl = body.querySelector(`[data-key="${cssEscape(r.key)}"] .spec-card-metrics`);
        if (dl) dl.replaceChildren(...metricRows(next));
        // The count line owns the "N unmeasured" claim, and it has just changed.
        result.unmeasured = Math.max(0, result.unmeasured - 1);
        bar.sync();
      }
    }

    boot();

    return { stop() { stopped = true; for (const l of live) l.stop(); } };
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
