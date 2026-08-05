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

export function tabs() { return TABS.slice(); }
export function current() { return stacks[activeTab][depths[activeTab]]; }
export function currentTab() { return activeTab; }
export function stackDepth(tab = activeTab) { return depths[tab]; }
export function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter(f => f !== fn); }; }

function routeOf(tab, entry) {
  return `#/${tab}${entry.screen === tab ? '' : '/' + entry.screen}`;
}

function parseRoute(hash) {
  const parts = (hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  const tab = TABS.includes(parts[0]) ? parts[0] : PRIMARY;
  const screen = parts[1] && screens.has(parts[1]) ? parts[1] : tab;
  return { tab, screen };
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
  const instance = def.mount(el, entry.params || {}) || null;
  return { screen: entry.screen, def, instance, el };
}

function unmount(m) {
  if (m?.def.unmount) m.def.unmount(m.instance, m.el);
}

export function render() {
  if (!host) return;
  const { base, modal } = visible();

  if (!mounted || mounted.screen !== base.screen) {
    unmount(mounted);
    mounted = mountInto(host.querySelector('#screen'), base);
  }

  const layer = host.querySelector('#overlay');
  if (modal) {
    if (!overlay || overlay.screen !== modal.screen) {
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

  const { tab, screen } = parseRoute(location.hash);
  activeTab = PRIMARY;
  history.replaceState({ tab: PRIMARY, depth: 0 }, '', `#/${PRIMARY}`);

  addEventListener('popstate', onPopState);

  if (tab !== PRIMARY) goTab(tab);
  if (screen !== tab) push(screen);
  render();
}

/** Test seam: drive the stack without a DOM or a real History. */
export const _internals = { stacks, depths, parseRoute, get activeTab() { return activeTab; }, TABS, PRIMARY };
