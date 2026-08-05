// ui/screens/atlas.js — the collection. Cards for creatures the player has kept.
//
// A saved creature is a `specimen:` record (genome + name + portrait), written
// from the tank's specimen sheet. This screen lists them as a two-column card
// grid (21 §7.2): portrait, common name, the derived binomial, a stat line, and
// Delete. Tokens only, no hex/px (N16).

import { t } from '../../trunk/i18n.js';
import * as store from '../../trunk/store.js';
import { seedAtlas } from '../../worlds/atlas_seed.js';
import { renderThumbnail, isStale, RENDER_TAG } from '../../render/thumbnail.js';
import { specCard } from '../cards.js';
import { button } from '../widgets.js';
import { lineageOf, nameFor } from '../vernacular.js';

export default {
  title: t('Atlas'),
  mount(el) {
    let stopped = false;

    const wrap = document.createElement('div');
    wrap.className = 'atlas';
    el.append(wrap);

    // Plant the authored library on first open (idempotent, keyed by hash), so a
    // fresh Atlas is the shipped creatures rather than an empty page. A failure
    // here must never blank the screen — the render below still lists whatever
    // records exist.
    async function seedThenRender() {
      try { await seedAtlas(); } catch { /* the library just won't appear */ }
      if (stopped) return;
      render();
    }

    async function render() {
      let keys = [];
      try { keys = await store.list('specimen:'); } catch { keys = []; }
      if (stopped) return;

      wrap.replaceChildren();

      if (keys.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'spec-empty-page';
        empty.textContent = t('No saved creatures yet. In the Tank, long-press a creature and tap Save to keep it here.');
        wrap.append(empty);
        return;
      }

      const loaded = [];
      for (const key of keys) {
        try { const spec = await store.get(key); if (spec?.genome) loaded.push({ key, spec }); }
        catch { /* skip a record from a future build rather than failing the page */ }
      }
      if (stopped) return;
      // Newest first.
      loaded.sort((a, b) => (b.spec.createdAt ?? 0) - (a.spec.createdAt ?? 0));

      const grid = document.createElement('div');
      grid.className = 'spec-grid';
      const imgs = new Map();
      for (const { key, spec } of loaded) {
        const c = card(key, spec);
        grid.append(c);
        imgs.set(key, c.querySelector('.spec-card-thumb'));
      }
      wrap.append(grid);

      upgradeRecords(loaded, imgs);
    }

    /**
     * THE MISSING HALF OF `RENDER_TAG`, and the backfill for the vernacular.
     *
     * The tag has been stamped onto every specimen since it existed and NOTHING
     * EVER COMPARED IT except `seedAtlas`, and only for authored records. So a
     * player's own creatures kept the portrait they were saved with forever, and
     * the day the render look changed their Atlas became a mix of two looks with
     * no way to reconcile it.
     *
     * The vernacular rides along because it is the same problem one step later:
     * a record saved before 14 existed has no common name, and nothing else
     * would ever give it one — it would show its binomial forever while its
     * neighbours showed names. It is minted against the WHOLE Atlas as the
     * lineage (14 §4), which is why the context is built once, outside the loop.
     *
     * ONE AT A TIME, YIELDING BETWEEN. `renderThumbnail` builds and tears down a
     * whole WebGL context per call; thirty-seven of them in a row would block the
     * main thread through the entire Atlas open. The page is already on screen
     * before this starts, portraits swap in as they finish, and a failure leaves
     * the old record rather than a broken card.
     */
    async function upgradeRecords(loaded, imgs) {
      const stale = loaded.filter(({ spec }) =>
        spec.genome && (isStale(spec) || !spec.vernacular));
      if (!stale.length) return;
      // Names already in the Atlas are `taken`, so §7's suppression applies and
      // the backfill does not manufacture duplicates.
      const ctx = lineageOf(loaded.map(({ spec }) => spec));
      // rAF DOES NOT FIRE ON A HIDDEN PAGE, so a bare `await rAF` wedges this
      // loop the moment the player switches browser tabs — and the Atlas would
      // then sit on a half-upgraded grid with no way to notice. The setTimeout
      // is the fallback that keeps it advancing; runBurst uses the same race for
      // the same reason. rAF still wins when visible, so a portrait is never
      // rendered in the middle of a paint.
      const yieldFrame = () => new Promise((r) => {
        let fired = false;
        const go = () => { if (!fired) { fired = true; r(); } };
        requestAnimationFrame(go);
        setTimeout(go, 50);
      });
      let renamed = 0;
      for (const { key, spec } of stale) {
        if (stopped) return;
        await yieldFrame();
        if (stopped) return;
        try {
          const next = { ...spec };
          if (isStale(spec)) {
            next.thumb = renderThumbnail(spec.genome, { worldId: spec.worldId ?? 'w1' });
            next.render = RENDER_TAG;
          }
          if (!next.vernacular) {
            const v = nameFor(spec.genome, ctx, spec.worldId ?? 'w1');
            next.vernacular = v.name;
            ctx.taken.add(v.name);
            renamed++;
          }
          await store.set(key, next);
          if (stopped) return;
          const img = imgs.get(key);
          if (img && next.thumb) img.src = next.thumb;
        } catch { /* keep the old record; the next open tries again */ }
      }
      // A backfilled name changes what the card says, and the card was built
      // before the name existed. One redraw at the end rather than a rebuild per
      // record — the portraits already swapped in place above.
      if (renamed && !stopped) render();
    }

    // The card itself lives in ui/cards.js — the Vivarium's import sheet shows
    // the same one, and a creature that looked different depending on which
    // screen drew it would undermine the only job a collection has.
    //
    // Authored specimens are the shipped library: labelled, and not deletable —
    // the next open would only plant them again, so a Delete button would be a
    // button that does nothing. Player-kept creatures keep their Delete.
    function card(key, spec) {
      return specCard(spec, {
        action: spec.source === 'authored' ? null : button(t('Delete'), async (e) => {
          e.currentTarget.disabled = true;
          try { await store.del(key); } catch { /* ignore — re-render reflects reality */ }
          render();
        }),
      });
    }

    seedThenRender();

    return { stop() { stopped = true; } };
  },
};
