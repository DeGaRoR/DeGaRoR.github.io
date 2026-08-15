// trunk/nav.js — explicit screen stack, four tab roots (20 §4, 21 §2).
//
// THE DESIGN DECISION, because A1's stop condition is about exactly this:
// the BROWSER HISTORY is the source of truth for WHERE YOU ARE. Our stacks only
// hold WHAT IS THERE. Every navigation pushes `{ tab, depth }`; popstate reads
// that state back and moves the cursor. Nothing consults the screen to decide
// what back means, so Android back, browser back, tab switching and sheet
// dismissal are one code path with no per-screen cases.
//
// Corollary: pop() is `history.back()`, never a direct stack mutation. If it were,
// our stack and the browser's would drift and every screen would need a fixup.

// `tank` and `forage` WERE two tabs and are now one. They were the same subject
// — creatures under physics — asked two halves of one question: the tank bred
// but never fed, forage fed but could not breed, and judging a lineage meant
// switching tabs and losing what you were looking at. See ui/screens/vivarium.js.
//
// VIVARIUM is the project's own word for it (`vivariumSeed`, `store.KEY.vivarium`),
// and it is still NOT `world`: World is reserved for L3 (many point agents, no
// physics), which cannot represent a full-physics creature at all.
const TABS = ['vivarium', 'atlas', 'world', 'settings'];
const PRIMARY = 'vivarium';

/**
 * The tabs that get a BUTTON. A subset of `TABS`, and deliberately not the same
 * list.
 *
 * `world` is a six-line placeholder and `settings` has been a stub for long
 * enough that a permanent quarter of the tab bar spent on two screens that do
 * nothing is worse than not having them: a tab bar is a claim about what the app
 * is for, and two of its four claims were false.
 *
 * THEY ARE STILL ROUTES. `TABS` is what `parseRoute` accepts and what each
 * stack is keyed by, so `#/settings` still resolves, `goTab('settings')` still
 * works, and nothing has to be rebuilt on the day either screen becomes real —
 * it is one entry in this list. Hiding a destination and deleting it are
 * different acts and this is the first one.
 */
const VISIBLE_TABS = ['vivarium', 'atlas'];

const screens = new Map();
const stacks = {};    // tab -> [{ screen, params }]
const depths = {};    // tab -> cursor into that stack
let activeTab = PRIMARY;
let host = null;
let mounted = null;   // { screen, instance, el }
let overlay = null;
let listeners = [];

/**
 * @param {string} id
 * @param {{ title:string, kind?:'destination'|'modal', mount:(el:HTMLElement, params:object)=>any, unmount?:Function }} def
 */
export function register(id, def) {
  screens.set(id, { kind: 'destination', ...def, id });
}

/** Every routable tab. The stacks, `parseRoute` and the gate use this one. */
export function tabs() { return TABS.slice(); }
/** The tabs that get a button in the bar. See `VISIBLE_TABS`. */
export function visibleTabs() { return VISIBLE_TABS.slice(); }
export function current() { return stacks[activeTab][depths[activeTab]]; }
export function currentTab() { return activeTab; }
export function stackDepth(tab = activeTab) { return depths[tab]; }
export function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn); }; }

/**
 * ── THE ID TAIL ──────────────────────────────────────────────────────────────
 *
 * A route was `#/<tab>[/<screen>]` and nothing more, which was enough while
 * every screen was a singleton. The specimen page is not: it is one screen over
 * three hundred subjects, and a route that cannot say WHICH is a route that
 * cannot be reloaded, shared or returned to by the browser's own back button —
 * you would land on "a specimen" with no way to know which one.
 *
 * One optional trailing segment, and only a screen that asked for it gets one.
 * `#/atlas/specimen/ab12cd34`.
 */
function routeOf(tab, entry) {
  const screen = entry.screen === tab ? '' : `/${entry.screen}`;
  const id = entry.params?.id ? `/${encodeURIComponent(entry.params.id)}` : '';
  return `#/${tab}${screen}${id}`;
}

function parseRoute(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  const tab = TABS.includes(parts[0]) ? parts[0] : PRIMARY;
  const screen = parts[1] && screens.has(parts[1]) ? parts[1] : tab;
  const id = screen !== tab && parts[2] ? decodeURIComponent(parts[2]) : null;
  return { tab, screen, id };
}

// ── navigation ───────────────────────────────────────────────────────────────

/** Go to a tab root. Preserves that tab's own stack position (20 §4). */
export function goTab(tab) {
  if (!TABS.includes(tab)) throw new Error(`unknown tab: ${tab}`);
  activeTab = tab;
  const entry = stacks[tab][depths[tab]];
  history.pushState({ tab, depth: depths[tab] }, '', routeOf(tab, entry));
  render();
}

/** Push a destination or a modal onto the ACTIVE tab's stack. */
export function push(screen, params = {}) {
  if (!screens.has(screen)) throw new Error(`unknown screen: ${screen}`);
  const stack = stacks[activeTab];
  stack.length = depths[activeTab] + 1;      // a new push invalidates forward history
  stack.push({ screen, params });
  depths[activeTab] = stack.length - 1;
  history.pushState({ tab: activeTab, depth: depths[activeTab] }, '', routeOf(activeTab, stack[depths[activeTab]]));
  render();
}

/** Always delegates to the browser. Sheet dismissal and back are the same action. */
export function pop() { history.back(); }

// ── history binding ──────────────────────────────────────────────────────────

function onPopState(e) {
  const st = e.state;
  if (!st || !TABS.includes(st.tab)) { render(); return; }
  activeTab = st.tab;
  // Do NOT truncate: forward navigation must find its entries again. The cursor
  // moves; the content stays.
  depths[st.tab] = Math.min(st.depth, stacks[st.tab].length - 1);
  render();
}

// ── rendering ────────────────────────────────────────────────────────────────

function visible() {
  const stack = stacks[activeTab];
  const top = stack[depths[activeTab]];
  const topDef = screens.get(top.screen);
  if (topDef.kind !== 'modal') return { base: top, modal: null };
  // A modal renders over whatever is beneath it — it is a stack entry, not a mode.
  for (let i = depths[activeTab] - 1; i >= 0; i--) {
    if (screens.get(stack[i].screen).kind !== 'modal') return { base: stack[i], modal: top };
  }
  return { base: stack[0], modal: top };
}

function mountInto(el, entry) {
  const def = screens.get(entry.screen);
  el.innerHTML = '';
  el.dataset.screen = entry.screen;
  const params = entry.params || {};
  const instance = def.mount(el, params) || null;
  return { screen: entry.screen, def, instance, el, params };
}

/**
 * ── A SCREEN IS ITS ID *AND* ITS PARAMS ──────────────────────────────────────
 *
 * `render` used to remount only when the screen ID changed, which was true while
 * every screen was a singleton. The specimen page is one screen over hundreds of
 * subjects: tapping a parent from a child pushed `specimen` onto `specimen`, the
 * ids matched, and nothing remounted — the URL advanced to the parent while the
 * page went on showing the child. A navigation that changes the address bar and
 * not the content is worse than one that does nothing, because the player has no
 * way to tell it failed.
 *
 * Shallow, because params are a flat bag of route scalars — `{ id }` today. A
 * deep compare would invite callers to put objects in there, which is exactly
 * what a route parameter must not be.
 */
function sameParams(a = {}, b = {}) {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

function unmount(m) {
  if (m?.def.unmount) m.def.unmount(m.instance, m.el);
}

export function render() {
  if (!host) return;
  const { base, modal } = visible();

  if (!mounted || mounted.screen !== base.screen || !sameParams(mounted.params, base.params)) {
    unmount(mounted);
    mounted = mountInto(host.querySelector('#screen'), base);
  }

  const layer = host.querySelector('#overlay');
  if (modal) {
    if (!overlay || overlay.screen !== modal.screen || !sameParams(overlay.params, modal.params)) {
      unmount(overlay);
      layer.hidden = false;
      overlay = mountInto(layer, modal);
    }
  } else if (overlay) {
    unmount(overlay); overlay = null; layer.hidden = true; layer.innerHTML = '';
  }

  for (const fn of listeners) fn({ tab: activeTab, screen: base.screen, modal: modal?.screen || null });
}

// ── boot ─────────────────────────────────────────────────────────────────────

/**
 * Deep links RECONSTRUCT the stack rather than landing on a leaf with empty
 * history (20 §4). The primary tab root is always seeded first, so back can
 * never produce a blank app.
 */
export function start(hostEl) {
  host = hostEl;
  for (const t of TABS) { stacks[t] = [{ screen: t, params: {} }]; depths[t] = 0; }

  const { tab, screen, id } = parseRoute(location.hash);
  activeTab = PRIMARY;
  history.replaceState({ tab: PRIMARY, depth: 0 }, '', `#/${PRIMARY}`);

  addEventListener('popstate', onPopState);

  if (tab !== PRIMARY) goTab(tab);
  // The id rides along, so a deep link to one specimen reconstructs the stack
  // AND lands on the right subject rather than on an empty detail page.
  if (screen !== tab) push(screen, id ? { id } : {});
  render();
}

/** Test seam: drive the stack without a DOM or a real History. */
export const _internals = { stacks, depths, parseRoute, get activeTab() { return activeTab; }, TABS, PRIMARY };
