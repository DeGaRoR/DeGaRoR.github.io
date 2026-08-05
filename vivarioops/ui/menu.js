// ui/menu.js — a small anchored popover.
//
// THE PROJECT HAD NO MENU PRIMITIVE. The only modal is the bottom sheet
// (`.tank-sheet`), and a sheet is the wrong shape for "turn Food off": it covers
// the aquarium you are toggling a layer ON, which is the one thing you need to
// see to know whether the toggle did anything. So the Vivarium's overflow —
// Food and Trails — needed something anchored and small, and this is it.
//
// DELIBERATELY NOT A COMPONENT LIBRARY. One anchor, one column of items, three
// ways to close (item, outside, Escape), and it positions itself by clamping to
// the viewport rather than by implementing collision detection. It is used in
// exactly one place; the day a second caller wants submenus is the day to look
// at this again.
//
// N14: no confirm()/alert()/prompt(). N16: tokens only.

import { mk } from './widgets.js';

let open = null;   // { el, onDoc, onKey } — at most one menu at a time

export function closeMenu() {
  if (!open) return;
  document.removeEventListener('pointerdown', open.onDoc, true);
  document.removeEventListener('keydown', open.onKey, true);
  open.el.remove();
  open.anchor?.setAttribute('aria-expanded', 'false');
  open = null;
}

/**
 * Open a menu anchored under `anchor`.
 *
 * Calling it while the same anchor's menu is open CLOSES it — a burger that
 * only opens is a burger you cannot dismiss by tapping the thing you opened it
 * with, which is the first thing everyone tries.
 *
 * @param {HTMLElement} anchor
 * @param {Array<{label:string, on?:boolean, onSelect:Function, keepOpen?:boolean}>} items
 *        `on` renders a checkmark — for toggles, where seeing the state IS the
 *        reason the menu was opened. `keepOpen` leaves the menu up so several
 *        toggles can be flipped in one visit.
 */
export function openMenu(anchor, items) {
  const wasMine = open?.anchor === anchor;
  closeMenu();
  if (wasMine) return null;

  const el = mk('menu');
  el.setAttribute('role', 'menu');
  for (const it of items) {
    const b = mk('menu-item', el, 'button');
    b.type = 'button';
    b.setAttribute('role', it.on === undefined ? 'menuitem' : 'menuitemcheckbox');
    if (it.on !== undefined) {
      b.setAttribute('aria-checked', it.on ? 'true' : 'false');
      b.dataset.on = it.on ? 'yes' : 'no';
    }
    mk('menu-item-label', b, 'span').textContent = it.label;
    mk('menu-item-tick', b, 'span');
    b.addEventListener('click', () => {
      it.onSelect();
      if (it.keepOpen) {
        // Re-read the state the item just changed, so the tick is the truth
        // rather than an optimistic echo of the tap.
        const now = typeof it.state === 'function' ? it.state() : !(b.dataset.on === 'yes');
        b.dataset.on = now ? 'yes' : 'no';
        b.setAttribute('aria-checked', now ? 'true' : 'false');
      } else closeMenu();
    });
    el.append(b);
  }
  document.body.append(el);

  // POSITION AFTER APPEND. The menu's own size is not known until it is in the
  // document, and clamping to the viewport without it puts a wide menu half off
  // the right edge on a phone — which is the only device that matters here.
  const a = anchor.getBoundingClientRect();
  const m = el.getBoundingClientRect();
  const pad = 8;
  const left = Math.max(pad, Math.min(a.left, window.innerWidth - m.width - pad));
  // Below the anchor, unless there is no room — then above it.
  const below = a.bottom + pad;
  const top = below + m.height + pad <= window.innerHeight ? below : Math.max(pad, a.top - m.height - pad);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;

  // CAPTURE PHASE, so a click on any control underneath closes the menu before
  // that control acts on it. Without capture the first tap outside is swallowed
  // by whatever it landed on and the menu stays up behind it.
  const onDoc = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } };
  document.addEventListener('pointerdown', onDoc, true);
  document.addEventListener('keydown', onKey, true);

  anchor.setAttribute('aria-expanded', 'true');
  open = { el, anchor, onDoc, onKey };
  return el;
}
