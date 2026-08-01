// ui/screens/atlas.js — the collection. Cards for creatures the player has kept.
//
// A saved creature is a `specimen:` record (genome + name + portrait), written
// from the tank's specimen sheet. This screen lists them as a two-column card
// grid (21 §7.2): portrait, common name, the derived binomial, a stat line, and
// Delete. Tokens only, no hex/px (N16).

import { t } from '../../trunk/i18n.js';
import * as store from '../../trunk/store.js';

export default {
  title: t('Atlas'),
  mount(el) {
    let stopped = false;

    const wrap = document.createElement('div');
    wrap.className = 'atlas';
    el.append(wrap);

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
      for (const { key, spec } of loaded) grid.append(card(key, spec));
      wrap.append(grid);
    }

    function card(key, spec) {
      const c = document.createElement('div');
      c.className = 'spec-card';

      const img = document.createElement('img');
      img.className = 'spec-card-thumb'; img.alt = '';
      if (spec.thumb) img.src = spec.thumb;
      c.append(img);

      const name = document.createElement('div');
      name.className = 'spec-card-name';
      name.textContent = spec.commonName || spec.binomial || t('Creature');
      c.append(name);

      // Show the binomial only when the player named it something else — otherwise
      // it would just repeat the name above.
      if (spec.binomial && spec.commonName && spec.commonName !== spec.binomial) {
        const bino = document.createElement('div');
        bino.className = 'spec-card-bino';
        bino.textContent = spec.binomial;
        c.append(bino);
      }

      const bodies = spec.stats?.bodies;
      const mass = spec.stats?.mass;
      const statLine = [
        bodies != null ? `${bodies} ${t('bodies')}` : null,
        mass != null ? `${mass.toFixed(2)} kg` : null,
      ].filter(Boolean).join(' · ');
      if (statLine) {
        const stats = document.createElement('div');
        stats.className = 'spec-card-stats';
        stats.textContent = statLine;
        c.append(stats);
      }

      const del = document.createElement('button');
      del.className = 'btn'; del.type = 'button'; del.textContent = t('Delete');
      del.addEventListener('click', async () => {
        del.disabled = true;
        try { await store.del(key); } catch { /* ignore — re-render reflects reality */ }
        render();
      });
      c.append(del);

      return c;
    }

    render();

    return { stop() { stopped = true; } };
  },
};
