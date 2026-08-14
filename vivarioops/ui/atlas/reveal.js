// ui/atlas/reveal.js — how many cards exist, and which of them have portraits.
//
// Two jobs, both about spending work on what the player can actually see.
//
// ── 1. INCREMENTAL REVEAL, NOT VIRTUALISATION ────────────────────────────────
//
// Cards are appended in chunks as the end of the list comes near. Nothing is
// ever removed.
//
// Virtualisation — a windowed pool of nodes over a spacer — was considered and
// rejected. With lazy portraits the memory a long list holds is already bounded
// (a row is primitives; the portraits are capped by an LRU), so windowing would
// buy DOM node count and pay for it in scroll-position mathematics, a
// variable-height problem the card grid genuinely has, and a broken in-page
// find. Revisit if a real thousand-row store stutters; do not build it on spec.
//
// ── 2. LAZY PORTRAITS ────────────────────────────────────────────────────────
//
// This is the change that makes the Atlas open instantly. Every card exposes a
// `loadThumb()` (ui/cards.js) called exactly once, when the card first comes
// within a screen of the viewport. A portrait is a 1024 px PNG data URL living
// inside its record, so the bytes a session decodes becomes a function of how
// far the player scrolled rather than of how many creatures they have ever kept.
//
// ── WHY GEOMETRY AND NOT IntersectionObserver ────────────────────────────────
//
// The observer was the obvious tool and it was built with one first. IT DOES NOT
// FIRE ON A PAGE THE BROWSER IS NOT RENDERING — measured here: a fresh observer
// on an element at top 65 of a 1062-tall viewport reported nothing at all while
// the tab was occluded. That turns "portraits load as you scroll" into "the
// Atlas has no pictures", which is strictly worse than loading everything.
//
// It is the same trap ui/screens/atlas.js already documents for rAF ("rAF DOES
// NOT FIRE ON A HIDDEN PAGE"), and it gets the same answer: do not depend on a
// callback the browser is entitled to withhold. `getBoundingClientRect` is a
// question about layout, and layout exists whether or not anything is being
// painted. A sweep on scroll, on resize, and once after each chunk covers every
// case, including the one where the player switches away mid-load and comes
// back to a list that had stalled.
//
// The sweep is cheap by construction: cards are in DOM order, so it stops at the
// first one past the horizon rather than measuring the whole list.

/** Cards per chunk. Enough that a flick lands inside the next batch rather than
 *  on the sentinel; small enough that the first paint is immediate. */
const CHUNK = 60;

/** How far past the fold counts as "coming up", as a fraction of the viewport.
 *  One screen: a portrait is decoded before it is looked at, not after. */
const LOOKAHEAD = 1;

/** Coalesce scroll into one sweep per frame at most. */
function throttled(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
    // The rAF may never fire on a hidden page. This is the floor.
    setTimeout(() => { if (queued) { queued = false; fn(); } }, 120);
  };
}

/**
 * Load the portrait of every card near the viewport, and keep doing so as the
 * player scrolls.
 *
 * @param {HTMLElement} host       the element the cards live in
 * @param {object} [o]
 * @param {Element|null} [o.scroller]  the scrolling box, or null for the page
 * @returns {{sweep:Function, stop:Function}}
 */
export function lazyThumbs(host, o = {}) {
  const scroller = o.scroller ?? null;
  let stopped = false;

  function horizon() {
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      return { top: r.top - r.height * LOOKAHEAD, bottom: r.bottom + r.height * LOOKAHEAD };
    }
    const h = window.innerHeight || 0;
    return { top: -h * LOOKAHEAD, bottom: h * (1 + LOOKAHEAD) };
  }

  /** Roughly a screenful, for the no-layout fallback below. */
  const BLIND_BATCH = 12;

  function sweep() {
    if (stopped) return;
    const { top, bottom } = horizon();

    // ── NO LAYOUT AT ALL ──────────────────────────────────────────────────
    //
    // A zero-height viewport is a real state — a page restored from bfcache, a
    // tab that has never been painted, an embedded frame the host has not sized
    // yet — and measured here at `innerHeight: 0`. Every rect is then zero, so
    // strict geometry concludes that NOTHING is visible and loads nothing, and
    // the Atlas sits there with no pictures until something happens to fire a
    // resize. That is a worse failure than loading a few portraits nobody looks
    // at, and it is the same judgement the rAF fallbacks elsewhere make: when
    // the browser will not tell you, do the useful thing rather than nothing.
    //
    // So: load a screenful blind, and keep listening. Once layout exists the
    // scroll and resize sweeps take over and the rest load normally.
    if (bottom <= top) {
      let n = 0;
      for (const el of host.querySelectorAll('[data-pending="yes"]')) {
        if (n++ >= BLIND_BATCH) break;
        el.closest('.spec-card, .spec-row')?.loadThumb?.();
      }
      return;
    }

    for (const el of host.querySelectorAll('[data-pending="yes"]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom < top) continue;          // scrolled well past; skip, cheaply
      if (r.top > bottom) break;             // DOM order: everything after is further
      el.closest('.spec-card, .spec-row')?.loadThumb?.();
    }
  }

  const onScroll = throttled(sweep);
  (scroller ?? window).addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // A page that comes back from the background has layout it did not have when
  // the list was built, and neither scroll nor resize necessarily fires for it.
  document.addEventListener('visibilitychange', onScroll);
  window.addEventListener('pageshow', onScroll);
  onScroll();

  return {
    sweep: onScroll,
    stop() {
      stopped = true;
      (scroller ?? window).removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('visibilitychange', onScroll);
      window.removeEventListener('pageshow', onScroll);
    },
  };
}

/**
 * Render `rows` into `host` in chunks, loading portraits as they approach.
 *
 * @param {HTMLElement} host       the scrolling container's content element
 * @param {Array} rows             already filtered, sorted and grouped
 * @param {(row:object)=>HTMLElement} build  makes one card
 * @param {object} [o]
 * @param {Element|null} [o.scroller]  the scrolling box, or null for the page
 * @returns {{stop:Function, shown:()=>number, sweep:Function}}
 */
export function reveal(host, rows, build, o = {}) {
  let at = 0;
  let stopped = false;

  const thumbs = lazyThumbs(host, o);

  const sentinel = document.createElement('div');
  sentinel.className = 'atlas-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  host.append(sentinel);

  function more() {
    if (stopped || at >= rows.length) return;
    const frag = document.createDocumentFragment();
    const end = Math.min(at + CHUNK, rows.length);
    for (; at < end; at++) {
      const card = build(rows[at]);
      if (card) frag.append(card);
    }
    host.insertBefore(frag, sentinel);
    if (at >= rows.length) sentinel.remove();
    thumbs.sweep();
  }

  /** Append the next chunk once the sentinel itself is within reach. */
  function maybeMore() {
    if (stopped || !sentinel.isConnected) return;
    const r = sentinel.getBoundingClientRect();
    const limit = o.scroller
      ? o.scroller.getBoundingClientRect().bottom + o.scroller.clientHeight
      : (window.innerHeight || 0) * 2;
    if (r.top <= limit) {
      more();
      // A chunk that lands entirely above the fold — a tall viewport, a short
      // card — leaves the sentinel still in reach, so keep going until it is not.
      maybeMore();
    }
  }

  const onScroll = throttled(maybeMore);
  const target = o.scroller ?? window;
  target.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  more();
  maybeMore();

  return {
    sweep: thumbs.sweep,
    shown: () => at,
    stop() {
      stopped = true;
      thumbs.stop();
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    },
  };
}
