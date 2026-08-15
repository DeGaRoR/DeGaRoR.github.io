// ui/screens/specimen.js — one creature, at length.
//
// The Atlas answers "which of these", and it answers it for three hundred at a
// time, which means every card is a compromise: one portrait, one name, two
// numbers. This screen is the other half — everything the project knows about a
// single animal, on a page with room to say it.
//
// ── WHAT IS FREE AND WHAT COSTS A SIMULATION ─────────────────────────────────
//
// Almost all of it is free. The family, the genus, the eighteen normalised
// traits, the body counts, the symmetry class — all of that is a pure function
// of the genome that ui/atlas/derive.js already computed and stored on the row,
// so this page paints instantly from primitives.
//
// The five FORAGE numbers are the exception: a 180 s trial per creature. They
// are shown when cached and offered as a button when not, with the tag they
// were taken under printed beside them — a number whose provenance is invisible
// is a number you cannot tell is stale.
//
// ── THE TRAIT BARS ARE RELATIVE, AND SAY SO ──────────────────────────────────
//
// A trait of 0.62 means nothing on its own. Against the corpus it means "wider
// than four fifths of your Atlas", which is the only form in which a normalised
// axis is a fact about an animal rather than about the normalisation. The
// comparison is one pass over the rows already in memory.
//
// Tokens only, no hex/px (N16).

import { t } from '../../trunk/i18n.js';
import * as nav from '../../trunk/nav.js';
import { mk, button } from '../widgets.js';
import * as atlas from '../atlas/index.js';
import { TRAIT_KEYS, FACET_BY_ID } from '../atlas/derive.js';
import { measureGenome } from '../atlas/measure.js';
import { buildForest, descendantsOf, coverage } from '../atlas/lineage.js';
import { PROFILE_TAG } from '../atlas/profile.js';
import * as query from '../atlas/query.js';
import * as release from '../release.js';
import * as names from '../names.js';
import { POPULATION } from '../../engine/l1/breed.js';

/** `specimen:<hash>`; the route carries the hash, not the key. */
const keyOf = (id) => `specimen:${id}`;

export default {
  title: t('Specimen'),
  mount(el, params = {}) {
    let stopped = false;
    const wrap = mk('spec-page', el);

    async function boot() {
      await atlas.ensureIndex({ cancelled: () => stopped });
      if (stopped) return;
      const row = params.id ? atlas.rowFor(keyOf(params.id)) : null;
      if (!row) { missing(); return; }
      paint(row);
    }

    /**
     * A record that is not there any more — deleted in another tab, or a stale
     * deep link. NEVER A BLANK SCREEN: an empty page with a back button the
     * player has to find is indistinguishable from a bug.
     */
    function missing() {
      wrap.replaceChildren();
      const p = mk('spec-empty-page', wrap, 'p');
      p.textContent = t('That creature is no longer in the Atlas.');
      p.append(button(t('Back to the Atlas'), () => nav.pop()));
    }

    function paint(row) {
      wrap.replaceChildren();

      // ── the portrait ──────────────────────────────────────────────────────
      //
      // Full width, and THIS is where the 1024 px thumbnail finally earns the
      // half-megabyte it costs. Everywhere else it is scaled into a card.
      const art = mk('spec-page-art', wrap);
      const img = mk('spec-page-thumb', art, 'img');
      img.alt = '';
      atlas.thumbFor(row.key).then((src) => { if (src && !stopped) img.src = src; });

      // ── the name block ────────────────────────────────────────────────────
      const head = mk('spec-page-head', wrap);
      mk('spec-page-name', head, 'h1').textContent = row.name;
      mk('spec-page-bino', head, 'i').textContent = row.binomial;
      // 13 §4.1: the family is the rank a player remembers, so it is a link into
      // the Atlas rather than a label — tapping it asks "what else is one of
      // these", which is the question having a taxonomy is for.
      const taxon = mk('spec-page-taxon', head);
      taxon.append(
        facetLink('family', row.family),
        txt(' · '), txt(row.genus), txt(' '), txt(row.species),
      );

      const badges = mk('spec-page-badges', wrap);
      badges.append(facetLink('source', row.source));
      if (row.shelf) badges.append(facetLink('shelf', row.shelf));
      if (row.niche) badges.append(facetLink('niche', row.niche));
      for (const l of row.labels) badges.append(facetLink('labels', l));

      if (row.headline) mk('spec-page-headline', wrap).textContent = row.headline;
      // `note` WAS ONLY EVER A TOOLTIP on the card — invisible on a touch device,
      // which is every device this is built for. It is prose, and this is the
      // page with room for prose.
      if (row.note) mk('spec-page-note', wrap, 'p').textContent = row.note;

      // ── the actions ───────────────────────────────────────────────────────
      const acts = mk('spec-page-acts', wrap);
      const go = button(t('Put in the vivarium'), async () => {
        go.disabled = true;
        const spec = await atlas.specFor(row.key);
        if (!spec?.genome) { go.disabled = false; return; }
        release.requestStock(POPULATION);
        await release.release([spec]);
        nav.goTab('vivarium');
      });
      go.className = 'btn spec-page-go';
      acts.append(go);
      // "What else is like this" — same family, same colour. The cheapest useful
      // action on the page: it is one query, and it is the question a player
      // browsing a collection actually has.
      acts.append(button(t('Find similar'), () => {
        query.set({ q: '', facets: { family: [row.family], ...(row.colour ? { colour: [row.colour] } : {}) } });
        nav.pop();
      }));

      // ── naming ────────────────────────────────────────────────────────────
      //
      // THE BINOMIAL IS NOT EDITABLE and that is 21 §7.3, not an omission: it is
      // a fact about the structure, derived, and if it were editable the whole
      // derivation would be decoration. The common name is the release valve and
      // has no rules (14 §7).
      const sec = section(wrap, t('Name'));
      const field = mk('field spec-page-field', sec, 'input');
      field.type = 'text';
      field.value = row.name;
      field.setAttribute('aria-label', t('Common name'));
      const save = button(t('Rename'), async () => {
        const v = field.value.trim();
        if (!v || v === row.name) return;
        save.disabled = true;
        save.textContent = t('Saving…');
        const next = await atlas.patch(row.key, { commonName: v });
        const spec = await atlas.specFor(row.key);
        if (spec) names.remember(row.key, spec);
        save.textContent = t('Rename');
        save.disabled = false;
        if (next && !stopped) paint(next);
      });
      sec.append(save);

      // ── morphology, all of it free ────────────────────────────────────────
      const morph = section(wrap, t('Body'));
      const f = FACET_BY_ID;
      rows(morph, [
        [t('Bodies'), `${row.bodies} · ${row.joints} ${t('joints')} · ${row.dof} ${t('dof')}`],
        // CGS (01 §7): engine units ARE cm / g. Relabels, not conversions.
        [t('Mass'), `${row.mass.toFixed(2)} g`],
        [t('Radius'), `${row.radius.toFixed(2)} cm`],
        [t('Symmetry'), f.get('sym').labelOf(row.sym)],
        [t('Segments'), `${f.get('seg').labelOf(row.seg)} · ${t('longest run')} ${row.longestRun}`],
        [t('Limbs'), `${f.get('limb').labelOf(row.limb)} · ${row.mirrored} ${t('mirrored')}`],
        [t('Depth'), `${row.maxDepth}`],
        [t('Senses'), row.receptors
          ? `${row.receptors} ${t('receptors')}`
          : t('blind — no receptors')],
        [t('Unusualness'), row.extremity.toFixed(2)],
      ]);

      // ── the measured record ───────────────────────────────────────────────
      const meas = section(wrap, t('Measured'));
      const measBody = mk('spec-page-meas', meas);
      paintMeasured(measBody, row);

      // ── traits, against the corpus ────────────────────────────────────────
      const tr = section(wrap, t('Traits'));
      mk('spec-page-hint', tr, 'p').textContent =
        t('Each axis against every creature in your Atlas. The mark is this one.');
      paintTraits(mk('spec-page-traits', tr), row);

      // ── ancestry ──────────────────────────────────────────────────────────
      //
      // TWO TIERS, STATED HONESTLY. Every genome carries `origin.founder` and a
      // generation count, so attribution always exists. Exact parent edges exist
      // only for creatures bred since they began being recorded — and a page that
      // drew an empty tree for the rest would be claiming they had no parents.
      const anc = section(wrap, t('Ancestry'));
      rows(anc, [
        [t('Founder'), row.founder
          ? row.founder
          : t('evolved — no authored ancestor')],
        [t('Generations'), `${row.generations}`],
      ]);
      const forest = buildForest(atlas.rows());

      // ── PARENTS ────────────────────────────────────────────────────────────
      // NOT `t('Bred from')`. V2's import scan matches the word `from` followed
      // by a quote ANYWHERE in a file, string literals included, and would read
      // the `)` after it as a module specifier. ui/atlas/derive.js and
      // ui/screens/vivarium.js:756 both carry a note about the same trap.
      mk('spec-page-sub', anc).textContent = t('Parents');
      if (row.parents == null) {
        const cov = coverage(atlas.rows());
        const p = mk('spec-page-hint', anc, 'p');
        // NAMING THE COVERAGE, not just this creature's gap. An empty ancestry
        // block with no explanation reads as broken; "3 of 41" says the feature
        // works and this animal is simply older than it.
        p.textContent = `${t('Not recorded — this creature predates the lineage log.')} `
          + `${cov.recorded} ${t('of')} ${cov.total} ${t('have recorded parents.')}`;
      } else if (!row.parents.length) {
        mk('spec-page-hint', anc, 'p').textContent =
          t('A founding draw — no parents, and that is recorded rather than assumed.');
      } else {
        const list = mk('spec-page-kin', anc);
        for (const h of row.parents) list.append(kin(atlas.rowFor(keyOf(h)), h));
      }

      // ── CHILDREN ───────────────────────────────────────────────────────────
      //
      // Derived by inverting the parent edges (ui/atlas/lineage.js), never
      // stored: an edge written once on the child cannot fall out of sync with
      // itself the way a second stored list would.
      const kids = forest.children.get(row.hash) ?? [];
      if (kids.length) {
        mk('spec-page-sub', anc).textContent = `${t('Offspring')} · ${kids.length}`;
        const list = mk('spec-page-kin', anc);
        for (const h of kids) list.append(kin(atlas.rowFor(keyOf(h)), h));

        // The whole line below it, breadth-first, for lineages more than one
        // generation deep. Only shown when there IS one.
        const deep = descendantsOf(forest, row.hash).filter((d) => d.depth > 1);
        if (deep.length) {
          mk('spec-page-hint', anc, 'p').textContent =
            `${t('and')} ${deep.length} ${t('further down the line.')}`;
        }
      }

      // ── delete ────────────────────────────────────────────────────────────
      //
      // AUTHORED SPECIMENS ARE NOT DELETABLE, and the control is absent rather
      // than disabled: `seedAtlas` replants the shipped library on the next open,
      // so it would be a button that appears to work and then undoes itself.
      if (row.source !== 'authored') {
        const del = button(t('Delete this creature'), async () => {
          del.disabled = true;
          await atlas.remove(row.key);
          names.forget(row.key);
          nav.pop();
        });
        del.className = 'btn spec-page-del';
        wrap.append(del);
      }
    }

    // ── the measured block, repainted after a Measure ────────────────────────
    function paintMeasured(host, row) {
      host.replaceChildren();
      const p = row.profile;

      if (row.profileState === 'bad') {
        mk('spec-page-hint', host, 'p').textContent =
          t('This creature came apart under the trial, so its numbers would be fiction. Nothing is recorded.');
        return;
      }
      if (!p) {
        mk('spec-page-hint', host, 'p').textContent =
          t('Not measured. The trial is 180 seconds of simulation and runs on this device.');
        const go = button(t('Measure now'), async () => {
          go.disabled = true;
          go.textContent = t('Measuring…');
          const spec = await atlas.specFor(row.key);
          if (!spec?.genome) { go.textContent = t('Measure now'); go.disabled = false; return; }
          const profile = await measureGenome(spec.genome);
          const next = await atlas.patch(row.key, { profile });
          if (!stopped && next) paintMeasured(host, next);
        });
        host.append(go);
        return;
      }

      rows(host, [
        // mg/s: grams are the engine unit but a creature eats milligrams a
        // second, and `0.034 g/s` is three leading characters of nothing.
        [t('Food'), `${(1000 * p.fps).toFixed(0)} mg/s`],
        [t('Ledger'), p.mult < 10 ? `${p.mult.toFixed(1)}×` : `${p.mult.toFixed(0)}×`],
        [t('Straightness'), p.straight.toFixed(2)],
        [t('Turn'), p.turn != null ? `${p.turn.toFixed(1)}°/s` : '—'],
      ]);
      if (row.canonCm != null) {
        rows(host, [[t('Beacon'), `${row.canonCm.toFixed(2)} cm`]]);
      }
      // THE TAG, VISIBLE. A cached measurement is a claim about the physics, the
      // food model and the window it was taken under; printing which one makes a
      // stale number explicable instead of merely wrong.
      mk('spec-page-tag', host).textContent = `${t('trial')} ${PROFILE_TAG}`;
    }

    /**
     * Eighteen bars, each with this creature's mark on the corpus's spread.
     *
     * The percentile is computed against every row in the Atlas, which is what
     * makes an abstract 0..1 axis mean something: `slenderness 0.62` is a number
     * about the normalisation, "slimmer than 78% of your creatures" is a number
     * about the animal.
     */
    function paintTraits(host, row) {
      const all = atlas.rows();
      for (const k of TRAIT_KEYS) {
        const v = row.traits?.[k];
        if (v == null) continue;
        const pool = all.map((r) => r.traits?.[k]).filter((x) => x != null);
        const below = pool.filter((x) => x < v).length;
        const pct = pool.length > 1 ? Math.round((100 * below) / (pool.length - 1)) : 50;

        const line = mk('spec-page-trait', host);
        mk('spec-page-trait-l', line, 'span').textContent = k;
        const track = mk('spec-page-trait-track', line);
        const fill = mk('spec-page-trait-fill', track);
        fill.style.width = `${Math.round(100 * Math.min(1, Math.max(0, v)))}%`;
        const n = mk('spec-page-trait-n', line, 'span');
        n.textContent = `${pct}%`;
        n.title = `${v.toFixed(3)} — ${t('higher than')} ${pct}% ${t('of the Atlas')}`;
      }
    }

    // ── small builders ──────────────────────────────────────────────────────

    function txt(s) { const n = document.createElement('span'); n.textContent = s; return n; }

    /** A badge that sets a filter and returns to the Atlas showing it. */
    function facetLink(facetId, value) {
      const f = FACET_BY_ID.get(facetId);
      const b = mk('atlas-chip', null, 'button');
      b.type = 'button';
      b.textContent = f ? f.labelOf(value) : value;
      b.addEventListener('click', () => {
        query.set({ facets: { [facetId]: [value] } });
        nav.pop();
      });
      return b;
    }

    /** A parent or child, tappable when we hold its record. */
    function kin(row, hash) {
      const b = mk('spec-page-kin-item', null, row ? 'button' : 'div');
      if (row) {
        b.type = 'button';
        const img = mk('spec-page-kin-thumb', b, 'img');
        img.alt = '';
        atlas.thumbFor(row.key).then((src) => { if (src) img.src = src; });
        mk('spec-page-kin-name', b, 'span').textContent = row.name;
        b.addEventListener('click', () => nav.push('specimen', { id: row.hash }));
      } else {
        // A parent hash we no longer hold a record for. Saying so beats omitting
        // it — the edge is real and the gap is the interesting part.
        mk('spec-page-kin-name', b, 'span').textContent =
          `${t('not in the Atlas')} · ${String(hash).slice(0, 8)}`;
      }
      return b;
    }

    function section(host, title) {
      const s = mk('section spec-page-sec', host, 'section');
      mk('spec-page-sec-h', s, 'h2').textContent = title;
      return s;
    }

    function rows(host, pairs) {
      for (const [k, v] of pairs) {
        const r = mk('row', host);
        mk('row-l', r, 'span').textContent = k;
        mk('row-v', r, 'span').textContent = v;
      }
    }

    boot();
    return { stop() { stopped = true; } };
  },

  unmount(instance) { instance?.stop?.(); },
};
